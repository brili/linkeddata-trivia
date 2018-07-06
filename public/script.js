let btn = $('#mainButton');
let fromThemeButton = $('#fromThemeButton');
let clueButton = $('#clueButton');
let btnTextOriginal = btn.text();
let clueButtonTextOriginal = clueButton.text();
let fromThemeButtonTextOriginal = fromThemeButton.text();
let alertElem = $('.patient');
let crosswordThemeDiv = $('.crosswordTheme');
let crosswordTheme = $('#crosswordTheme');
let wordsArray = [];
let myTheme = null;

/* set language and paint canvas in browser */
var game;

$(function() {
    var width = 20;
    var height = 15;
    $("canvas").attr("width", 40 * width).attr("height", 40 * height);


    fromThemeButton.attr("disabled", true);
    var canvas = $("canvas")[0];
    game = new Crossword(canvas, width, height);
    game.clearCanvas(true);

    $("#add-clue button").click(function() {
        var clue = $("#question").val();
        var word = $("#word").val().split(/\s/)[0];

        add(word, clue);

        $("#add-clue input").val("");
    });
});



btn.click(() => {
    btn.attr("disabled", true);
    btn.text('↺ Loading ...');
    alertElem.show();
    fromThemeButton.attr("disabled", true);

    crosswordTheme.text("");

    let answerButtons = [];
    let inputTheme = $('#inputTheme').val();
    $.getJSON('/api/theme', {"theme": inputTheme}, data => {
        if(!data){
            alert("No theme found. Try manual theme");
        }
        else{

            var clue = data.q;
            var word = data.correctAnswer.toLowerCase().replace(/[^a-zA-Z0-9]+/g, "");
            crosswordThemeDiv.show();
            crosswordTheme.show();
            crosswordTheme.text(data.theme);
            myTheme = data.theme;
            add(word, clue);

            $("#add-clue input").val("");
            fromThemeButton.attr("disabled", false);
        }
        alertElem.hide();

        btn.attr("disabled", false);
        btn.text(btnTextOriginal);
    });
});

fromThemeButton.click(() => {
    fromThemeButton.attr("disabled", true);
    fromThemeButton.text('↺ Loading ...');
    alertElem.show();

    let answerButtons = [];
    $.getJSON('/api/theme', {"theme": myTheme}, data => {
        if(!data){
            alert("Nothing found. Try again");
        }
        else{

            var clue = data.q;
            var word = data.correctAnswer.toLowerCase().replace(/[^a-zA-Z0-9]+/g, "");

            add(word, clue);

            $("#add-clue input").val("");
        }
        alertElem.hide();

        fromThemeButton.attr("disabled", false);
        fromThemeButton.text(fromThemeButtonTextOriginal);
    });
});

clueButton.click(() => {
    clueButton.attr("disabled", true);
    clueButton.text('↺ Loading ...');
    alertElem.show();

    $.getJSON('/api/random', data => {
        if(!data){
            alert("Nothing found. Try again");
        }
        else{

            var clue = data.q;
            var word = data.correctAnswer.toLowerCase().replace(/[^a-zA-Z0-9]+/g, "");

            add(word, clue);

            $("#add-clue input").val("");
        }
        alertElem.hide();

        clueButton.attr("disabled", false);
        clueButton.text(clueButtonTextOriginal);
    });
});

function add(word, clue) {
    if(wordsArray.includes(word)){
        alert("An error occurred try again!");
        return;
    }

    game.addWord(word, function(error, clueAnchor, direction) {

        if (error) {
            alert("An error occurred try again!");
            return;
        }

        wordsArray.push(word);
        let clueRef = $("<li>");
        clueRef.append($("<strong>").text(clueAnchor));
        clueRef.append(clue || word);
        clueRef.append($("<small>").text(word));
        $("#" + direction + " .list").append(clueRef);
    });
}