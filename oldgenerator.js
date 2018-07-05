'use strict';

const SPARQL_ENDPOINT = 'http://dbpedia.org/sparql',
    RANKING_ENDPOINT = 'http://212.47.248.93:8080/api/ranking';

const SparqlClient = require('sparql-client'),
    client = new SparqlClient(SPARQL_ENDPOINT),
    fs = require('fs'),
    path = require('path'),
    request = require('request-promise'),
    trends = require('google-trends'),
    _ = require('lodash'),
    moment = require('moment');

const blacklist = JSON.parse(fs.readFileSync(path.normalize('./resources/blacklist.json'))),
    prefixMap = JSON.parse(fs.readFileSync(path.normalize('./resources/prefixes.json'))),
    inversePrefixMap = _.invert(prefixMap),
    sortedClasses = JSON.parse(fs.readFileSync(path.normalize('./resources/classes_sorted.json'))),
    prefixString = generatePrefixString(prefixMap);

let numTotalEntities = _.keys(sortedClasses).reduce((acc, val) => acc + sortedClasses[val], 0);
let crossword_row = 10,
    crossword_col = 10;
let matrix = [];
let matrix_rows = [];

/* Currently only supports to generate 1 question at a time. */
function generateTheme(num, startTime, retries, trends) {
    /* 
    Step 1: Get random entity from DBPedia
    Step 2: Get entity label    
    Step 3: Get relevant properties for this entity
    Step 4: Combine relevant properties with those actually available and fetch meta data for them 
    Step 5: Fetch actual value for the specific entity and property to be the correct answer
    Step 6: Generate or fetch 3 alternative answers. For dates, years and numbers random values within an interval are generated. For resources values the labels of three other entities within the same class are fetched. Plain string and other types are ignored for now.
    */

    let promises = [];
    let propertyInfos = {};
    let entity = null;
    let entityLabel = '';
    let trend = null;

    if (!startTime) startTime = moment();
    if (!retries) retries = 0;

    if(trends.length > num - 1){
        trend = trends[num-1];
    } else{
        console.log("dbpedia query returned empty result");
        return null;
    }

    return fetchEntityByKeyword(trend, retries)
        .then(ent => {
            entity = ent.e;
            entityLabel = ent.label;
        })
        .then(() => {
            let promises = [];
            promises.push(fetchEntityProperties(entity));
            promises.push(getTopEntityProperties(entity, entityLabel));
            return Promise.all(promises);
        })
        .then(values => _.intersection(values[0], values[1]))
        .then(values => [values[_.random(0, values.length - 1, false)]]) // only select one property at a time
        .then(values => multiFetchPropertyInfo(values.slice(0, num)))
        .then(values => { propertyInfos = values; })
        .then(() => multiFetchCorrectAnswerValue(entity, _.sortBy(_.keys(propertyInfos))))
        .then(values => {
            let sortedPropertyKeys = _.sortBy(_.keys(propertyInfos));
            values.forEach((v, i) => propertyInfos[sortedPropertyKeys[i]].correctAnswer = v);
            return propertyInfos;
        })
        .then(values => multiFetchAlternativeAnswers(propertyInfos))
        .then(values => {
            let sortedPropertyKeys = _.sortBy(_.keys(propertyInfos));
            values.forEach((v, i) => propertyInfos[sortedPropertyKeys[i]].alternativeAnswers = v);
        })
        .then(() => {
            console.log(`\n[INFO] Fetched data for entity ${entity}.\n`);
            let prop = propertyInfos[_.keys(propertyInfos)[0]]; // Only support one at a time for now
            let r = {
                q: `What is the ${prop.label} of ${entityLabel}?`,
                correctAnswer: prop.correctAnswer,
                alternativeAnswers: prop.alternativeAnswers,
                processingTime: moment().diff(startTime) + ' ms',
                retries: retries
            };
            console.log(r.toString());
            //FOUND the theme of the crossword now based on that find other words
            return r;
        })
        .catch((e) => {
            console.log(`\n[INFO] Failed to fetch complete data for entity ${entity}. Retrying another one with num ${num} retry count ${retries}. (${e})\n`);
            if(retries > 10){
                num = num + 1;
                retries = 0;
            }

            return generateTheme(num, startTime, ++retries, trends);
        });
}

function generateRandomTheme(num, startTime, retries, previousTheme) {

    if(previousTheme)
        return previousTheme;
    /*
    Step 1: Get random entity from DBPedia
    Step 2: Get entity label
    Step 3: Get relevant properties for this entity
    Step 4: Combine relevant properties with those actually available and fetch meta data for them
    Step 5: Fetch actual value for the specific entity and property to be the correct answer
    Step 6: Generate or fetch 3 alternative answers. For dates, years and numbers random values within an interval are generated. For resources values the labels of three other entities within the same class are fetched. Plain string and other types are ignored for now.
    */

    let promises = [];
    let propertyInfos = {};
    let entity = null;
    let entityLabel = '';

    if (!startTime) startTime = moment();
    if (!retries) retries = 0;

    //crossword = 5x5

    return fetchRandomEntity()
        .then(e => { entity = e; })
        .then(() => fetchLabel(entity))
        .then(label => { entityLabel = label; })
        .then(() => {
            let promises = [];
            promises.push(fetchEntityProperties(entity));
            promises.push(getTopEntityProperties(entity, entityLabel));
            return Promise.all(promises);
        })
        .then(values => _.intersection(values[0], values[1]))
        .then(values => [values[_.random(0, values.length - 1, false)]]) // only select one property at a time
        .then(values => multiFetchPropertyInfo(values.slice(0, num)))
        .then(values => { propertyInfos = values; })
        .then(() => multiFetchCorrectAnswerValue(entity, _.sortBy(_.keys(propertyInfos))))
        .then(values => {
            let sortedPropertyKeys = _.sortBy(_.keys(propertyInfos));
            values.forEach((v, i) => propertyInfos[sortedPropertyKeys[i]].correctAnswer = v);
            return propertyInfos;
        })
        .then(values => multiFetchAlternativeAnswers(propertyInfos))
        .then(values => {
            let sortedPropertyKeys = _.sortBy(_.keys(propertyInfos));
            values.forEach((v, i) => propertyInfos[sortedPropertyKeys[i]].alternativeAnswers = v);
        })
        .then(() => {
            console.log(`\n[INFO] Fetched data for entity ${entity}.\n`);
            let prop = propertyInfos[_.keys(propertyInfos)[0]]; // Only support one at a time for now
            let r = {
                q: `What is the ${prop.label} of ${entityLabel}?`,
                correctAnswer: prop.correctAnswer,
                alternativeAnswers: prop.alternativeAnswers,
                processingTime: moment().diff(startTime) + ' ms',
                retries: retries
            };
            console.log(r.toString());
            return r;
        })
        .catch((e) => {
            console.log(`\n[INFO] Failed to fetch random theme entity ${entity}. Retrying another one retry count ${retries}. (${e})\n`);
            if(retries > 100 || e == 61){
                return false;
            }

            return generateRandomTheme(num, startTime, ++retries, null);
        });
}

function generateOtherWords(num, startTime, retries) {

    /*
    Step 1: Get random entity from DBPedia
    Step 2: Get entity label
    Step 3: Get relevant properties for this entity
    Step 4: Combine relevant properties with those actually available and fetch meta data for them
    Step 5: Fetch actual value for the specific entity and property to be the correct answer
    Step 6: Generate or fetch 3 alternative answers. For dates, years and numbers random values within an interval are generated. For resources values the labels of three other entities within the same class are fetched. Plain string and other types are ignored for now.
    */

    if(matrix_rows.length >= matrix[0].length || num > matrix[0].length){
        return true;
    }


    let promises = [];
    let propertyInfos = {};
    let entity = null;
    let entityLabel = '';
    let werd = null;

    if (!startTime) startTime = moment();
    if (!retries) retries = 0;

    if(matrix[0].length > num){
        werd = matrix[num];
    } else{
        console.log("dbpedia query returned empty result for generateOtherWords");
        return null;
    }

    return fetchRandomEntityWithRegex(matrix, num)
        .then(ent => {
            entity = ent.e;
            entityLabel = ent.label;
        })
        .then(() => {
            let promises = [];
            promises.push(fetchEntityProperties(entity));
            promises.push(getTopEntityProperties(entity, entityLabel));
            return Promise.all(promises);
        })
        .then(values => _.intersection(values[0], values[1]))
        .then(values => [values[_.random(0, values.length - 1, false)]]) // only select one property at a time
        .then(values => multiFetchPropertyInfo(values.slice(0, num + 1)))
        .then(values => { propertyInfos = values; })
        .then(() => multiFetchCorrectAnswerValue(entity, _.sortBy(_.keys(propertyInfos))))
        .then(values => {
            let sortedPropertyKeys = _.sortBy(_.keys(propertyInfos));
            values.forEach((v, i) => propertyInfos[sortedPropertyKeys[i]].correctAnswer = v);
            return propertyInfos;
        })
        .then(values => multiFetchAlternativeAnswers(propertyInfos))
        .then(values => {
            let sortedPropertyKeys = _.sortBy(_.keys(propertyInfos));
            values.forEach((v, i) => propertyInfos[sortedPropertyKeys[i]].alternativeAnswers = v);
        })
        .then(() => {
            console.log(`\n[INFO] Fetched data for entity ${entity}.\n`);
            let prop = propertyInfos[_.keys(propertyInfos)[0]]; // Only support one at a time for now
            let r = {
                q: `What is the ${prop.label} of ${entityLabel}?`,
                correctAnswer: prop.correctAnswer,
                alternativeAnswers: prop.alternativeAnswers,
                processingTime: moment().diff(startTime) + ' ms',
                retries: retries
            };
            console.log(r.toString());
            return r;
        })
        .catch((e) => {
            console.log(`\n[INFO] Failed to fetch other keywordtheme entity ${entity} for num: ${num}. Retrying another one retry count ${retries}. (${e})\n`);
            if(retries > 10){
                retries = 0;
                num = num + 1;
            }

            return generateOtherWords(num, startTime, ++retries);
        });
}

function multiFetchAlternativeAnswers(propertyInfos) {
    console.time('multiFetchAlternativeAnswers');
    let promises = [];
    _.sortBy(_.keys(propertyInfos)).forEach(key => promises.push(fetchAlternativeAnswers(propertyInfos[key])));
    return Promise.all(promises)
        .then(values => {
            console.timeEnd('multiFetchAlternativeAnswers');
            return values;
        });
}

function fetchAlternativeAnswers(propertyInfo) {
    return new Promise((resolve, reject) => {
        let answerClass = extractAnswerClass(propertyInfo);
        switch (answerClass) {
            case 'year':
                randomYearAnswers(3, parseInt(propertyInfo.correctAnswer)).then(resolve);
                break;
            case 'date':
                randomDateAnswers(3, propertyInfo.correctAnswer).then(resolve);
                break;
            case 'int':
                randomNumericAnswers(3, parseInt(propertyInfo.correctAnswer), false).then(resolve);
                break;
            case 'float':
                randomNumericAnswers(3, parseFloat(propertyInfo.correctAnswer), true).then(resolve);
                break;
            default:
                if (_.keys(sortedClasses).includes(toPrefixedUri(answerClass))) randomClassAnswers(3, answerClass).then(resolve);
                else reject(1);
        }
    });
}

// TODO: Use construct query instead of multiple sequential select queries.
function multiFetchCorrectAnswerValue(entityUri, propertyUris) {
    console.time('multiFetchAlternativeAnswers');
    let promises = [];
    propertyUris.forEach(uri => promises.push(fetchCorrectAnswerValue(entityUri, uri)));
    return Promise.all(promises)
        .then(values => {
            console.timeEnd('multiFetchAlternativeAnswers');
            return values;
        });
}

function fetchCorrectAnswerValue(entityUri, propertyUri) {
    return new Promise((resolve, reject) => {
        propertyUri = propertyUri.indexOf('http://') > -1 ? '<' + propertyUri + '>' : propertyUri;
        entityUri = entityUri.indexOf('http://') > -1 ? '<' + entityUri + '>' : entityUri;
        client.query(prefixString + `SELECT ?answer WHERE {
                ?resource ?property ?answerRes .
                ?answerRes rdfs:label ?answer .
                FILTER(strlen(?answer) < 10) .
                FILTER(lang(?answer) = "en")
            }`)
            .bind('resource', entityUri)
            .bind('property', propertyUri)
            .execute((err, results) => {
                if (err || !results || !results.results.bindings.length) return reject(2);
                resolve(results.results.bindings[0].answer.value);
            });
    });
}

// TODO: Use construct query instead of multiple sequential select queries.
function multiFetchPropertyInfo(propertyUris) {
    console.time('multiFetchPropertyInfo');
    return new Promise((resolve, reject) => {
        let promises = [];
        propertyUris.forEach(uri => promises.push(fetchPropertyInfo(uri)));
        Promise.all(promises)
            .then((results) => {
                return results.reduce((acc, val, i) => {
                    acc[propertyUris[i]] = val;
                    return acc;
                }, {});
            })
            .then(values => {
                console.timeEnd('multiFetchPropertyInfo');
                return values;
            })
            .then(resolve)
            .catch(reject);
    });
}

function fetchPropertyInfo(propertyUri) {
    return new Promise((resolve, reject) => {
        if (!propertyUri) return reject(9);
        propertyUri = propertyUri.indexOf('http://') == 0 ? '<' + propertyUri + '>' : propertyUri;
        client.query(prefixString + `
            SELECT ?range ?label WHERE {
                ?property rdfs:label ?label .
                ?property rdfs:range ?range .
                FILTER(lang(?label) = "en")
            }`)
            .bind('property', propertyUri)
            .execute((err, results) => {
                if (err || !results || !results.results.bindings.length) return reject(4);
                resolve({
                    label: results.results.bindings[0].label.value,
                    range: results.results.bindings[0].range.value
                });
            });
    });
}

function fetchEntityProperties(entityUri) {
    console.time('fetchEntityProperties');
    return new Promise((resolve, reject) => {
        client.query(prefixString + `SELECT DISTINCT(?p) WHERE {
                ?resource ?p _:bn1 .
                ?p rdfs:label _:bn2 .
                FILTER(lang(_:bn2) = "en")
            }`)
            .bind('resource', entityUri)
            .execute((err, results) => {
                console.timeEnd('fetchEntityProperties');
                if (err) return reject(5);
                let properties = results.results.bindings.map(b => b.p.value);
                resolve(properties);
            });
    });
}

function fetchLabel(entityUri) {
    console.time('fetchLabel');
    return new Promise((resolve, reject) => {
        entityUri = entityUri.indexOf('http://') == 0 ? '<' + entityUri + '>' : entityUri;
        client.query(prefixString + `
            SELECT ?label WHERE {
                ?entity rdfs:label ?label .
                FILTER(lang(?label) = "en")
            }`)
            .bind('entity', entityUri)
            .execute((err, results) => {
                console.timeEnd('fetchLabel');
                if (err || !results || !results.results.bindings.length) return reject(3);
                resolve(results.results.bindings[0].label.value);
            });
    });
}

function getTrends(inputKeyword){

    return new Promise(function (resolve, reject) {
        if(inputKeyword){
            resolve([inputKeyword]);
        }else{
            trends.load(['us'], function (err, result) {
                if (err) {
                    reject(err);
                } else {
                    let r = [];
                    _.each(result.us, function (p) {
                        if(p.title.length <= crossword_row) // TODO split the string if needed
                            r.push(p.title);
                    });
                    resolve(r);
                }
            })
        }
    });
}


function generatePrefixString(prefixes) {
    return _.keys(prefixes).map(k => `prefix ${k}: <${prefixes[k]}>\n`).toString().replace(/,/g, '');
}

function fetchRandomEntity() {
    //OFFSET ${_.random(0, numTotalEntities)}
    console.time('fetchRandomEntity');
    return new Promise((resolve, reject) => {
        client.query(prefixString + `SELECT ?e ?label WHERE { 
                ?e dbo:wikiPageID _:bn3 .
                ?e rdfs:label ?label
                FILTER(lang(?label) = "en")
                FILTER(strlen(?label) = 10) 
                FILTER(lang(?label) = "en")
            } 
            OFFSET ${_.random(0, 20)} 
            LIMIT 1`)
            .execute((err, results) => {
                console.timeEnd('fetchRandomEntity');
                if (err || !results || !results.results.bindings.length) return reject(6);
                let r = {
                    e: toPrefixedUri(results.results.bindings[0].e.value),
                    label: toPrefixedUri(results.results.bindings[0].label.value)
                };
                resolve(r);
            });
    });
}

function fetchRandomEntityWithRegex(matrix, num) {
    console.time('fetchRandomEntity');
    return new Promise((resolve, reject) => {
        client.query(prefixString + `SELECT ?e ?label WHERE { 
                ?e dbo:wikiPageID _:bn3 .
                ?e rdfs:label ?label
                FILTER regex(?label, "${generateRegex(matrix, num, 0)}")
                FILTER not exists { ?e rdf:type skos:Concept } 
                FILTER(lang(?label) = "en")
            } 
            OFFSET ${_.random(0, 500)}
            LIMIT 1`)
            .execute((err, results) => {
                console.timeEnd('fetchRandomEntity');
                if (err || !results || !results.results.bindings.length) return reject(6);
                let r = {
                    e: toPrefixedUri(results.results.bindings[0].e.value),
                    label: toPrefixedUri(results.results.bindings[0].label.value)
                };
                resolve(r);
            });
    });
}

function generateRegex(matrix, num, index){
    let rg = '';

    rg = rg+matrix[index][num];

    for(let i=1; i< crossword_col; i++){
            rg = rg + '.';
    }
    return rg;
    // let rg = '';
    //
    // if(axis){
    //     for(let i= col; i < col.length; i++){
    //         if(matrix[row][i])
    //             rg = rg + matrix[row][i];
    //         else
    //             rg = rg + '.';
    //     }
    // }else{
    //     for(let i= row; i < row.length; i++){
    //         if(matrix[i][col])
    //             rg = rg + matrix[i][col];
    //         else
    //             rg = rg + '.';
    //     }
    // }
    //
    // return rg;
}

function fetchEntityByKeyword(keyword, offset) {
    console.time('fetchEntityByKeyword');
    return new Promise((resolve, reject) => {
        if(!keyword)
            return reject(6);
        client.query(prefixString + `SELECT ?e ?label WHERE { 
                ?e rdfs:label ?label
                FILTER(?label="${keyword}"@en)
                FILTER not exists { ?e rdf:type skos:Concept }
            }`)
            .execute((err, results) => {
                console.timeEnd('fetchEntityByKeyword');
                if (err || !results || !results.results.bindings.length) return reject(6);
                let rs = {
                    e: toPrefixedUri(results.results.bindings[0].e.value),
                    label: results.results.bindings[0].label.value
                };
                // if(rs.e.includes("wd"))
                //     return reject(61);
                resolve(rs);
            });
    });
}



function getTopEntityProperties(entityUri, entityLabel) {
    console.time('getTopEntityProperties');

    let opts = {
        uri: RANKING_ENDPOINT,
        qs: {
            q: entityLabel,
            top: 50
        },
        json: true
    };

    return request(opts)
        .then(results => Array.isArray(results) ? results : _.keys(results))
        .then(results => results.filter(v => !blacklist.includes(v)))
        .then(results => results.filter(v => v.indexOf('/property/') === -1)) // dbp:-properties don't have ranges and labels
        .then(results => {
            console.timeEnd('getTopEntityProperties');
            return results;
        });
}

function extractAnswerClass(property) {
    if (property.range === 'http://www.w3.org/2001/XMLSchema#gYear') return 'year';
    else if (property.range === 'http://www.w3.org/2001/XMLSchema#date') return 'data';
    else if (parseInt(property.correctAnswer.match(/^-?\d*(\d+)?$/)) > 0) return 'int';
    else if (parseFloat(property.correctAnswer.match(/^-?\d*(\.\d+)?$/)) > 0) return 'float';
    else return property.range;
}

function randomDateAnswers(num, reference) {
    console.time('randomDateAnswers');

    let referenceDate = moment(reference);

    let randoms = [];
    for (let i = 0; i < num; i++) {
        if (i % 2 == 0) randoms.push(referenceDate.clone().add(_.random(0, 2920), 'days').format('YYYY-MM-DD'));
        else randoms.push(referenceDate.clone().subtract(_.random(0, 2920), 'days').format('YYYY-MM-DD'));
    }
    console.timeEnd('randomDateAnswers');
    return Promise.resolve(randoms);
}

function randomYearAnswers(num, reference) {
    console.time('randomYearAnswers');

    let before = Math.min(reference + 200, 2017);
    let after = reference - 200;

    let randoms = [];
    for (let i = 0; i < num; i++) {
        randoms.push(_.random(after, before, false));
    }
    console.timeEnd('randomYearAnswers');
    return Promise.resolve(randoms);
}

function randomNumericAnswers(num, reference, float) {
    console.time('randomNumericAnswers');

    let oom = orderOfMagnitude(reference);
    let fixed = decimalPlaces(reference);

    let randoms = [];
    for (let i = 0; i < num; i++) {
        randoms.push(_.random(reference - Math.pow(10, oom - 1) * 9, reference + Math.pow(10, oom - 1) * 9, float).toFixed(fixed));
    }
    console.timeEnd('randomNumericAnswers');
    return Promise.resolve(randoms);
}

function randomClassAnswers(num, classUri) {
    let promises = [];
    classUri = classUri.indexOf('http://') == 0 ? '<' + classUri + '>' : classUri;

    console.time('randomClassAnswers');
    for (let i = 0; i < num; i++) {
        promises.push(new Promise((resolve, reject) => {
            client.query(prefixString + ` 
                SELECT ?e WHERE {
                    ?r rdf:type ?class .
                    ?r rdfs:label ?e .
                    FILTER(lang(?e) = "en")
                } 
                OFFSET ${_.random(0, getClassCount(classUri) - 1, false)} 
                LIMIT 1`)
                .bind('class', classUri)
                .execute((err, results) => {
                    if (err || !results || !results.results.bindings.length) return reject(7);
                    resolve(results.results.bindings[0].e.value);
                });
        }));
    }
    return Promise.all(promises)
        .then(values => {
            console.timeEnd('randomClassAnswers');
            return values;
        });
}

function orderOfMagnitude(n) {
    return Math.floor(Math.log(n) / Math.LN10 + 0.000000001);
}

function decimalPlaces(num) {
    var match = ('' + num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
    if (!match) { return 0; }
    return Math.max(0, (match[1] ? match[1].length : 0) - (match[2] ? +match[2] : 0));
}

function getClassCount(classUri) {
    return sortedClasses[toPrefixedUri(classUri)];
}

function toPrefixedUri(uri) {
    uri = uri.replace(/</, '').replace(/>/, '');
    let prefix = _.keys(inversePrefixMap).filter(k => uri.indexOf(k) > -1)[0];
    let shortUri = uri.replace(prefix, inversePrefixMap[prefix] + ':');
    return shortUri;
}

//@param axis true for horizontal
function insertWordToMatrix(word, row, col, axis){
    word = word.replace(/\s/g,''); //trim all whitespace
    matrix[matrix.length]=word.split('');
}

module.exports = {
    generateRandom: (inputTheme) => {
        return getTrends(null)
            .then(result =>{
                result = ['Google'];

                // return generateOtherWords(0, null, null);

                // return fetchRandomEntity(result);
                //sample matrix 10x10
                return result;

            })
            .then(result => generateTheme(1, null, null, result))
            .then(theme => generateRandomTheme(1, null, null, theme))
            .then(theme => {
                if(!theme)
                    return [];
                insertWordToMatrix(theme.correctAnswer, 0, 0 , true);
                return generateOtherWords(0, null, null);
                console.log(theme);
            })
            .then(() => {
               return matrix;
            });
    }
}
