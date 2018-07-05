let btn = $('#mainButton');
let clueButton = $('#clueButton');
let btnTextOriginal = btn.text();
let clueButtonTextOriginal = clueButton.text();
let answerButtonsElem = $('#answerButtons');
let questionHeadingElem = $('#questionHeading');
let questionContainerElem = $('.questionContainer');
let alertElem = $('.patient');
let crosswordThemeDiv = $('.crosswordTheme');
let crosswordTheme = $('#crosswordTheme');

/* set language and paint canvas in browser */
var game;

$(function() {
    var width = 20;
    var height = 15;
    $("canvas").attr("width", 40 * width).attr("height", 40 * height);

    var canvas = $("canvas")[0];
    game = new Crossword(canvas, width, height);
    game.clearCanvas(true);



    $("#add-clue button").click(function() {
        var clue = $("#question").val();
        var word = $("#word").val().split(/\s/)[0];

        game.addWord(word, function(error, clueAnchor, direction) {
            if (error) {
                throw error;
            }
            var clueRef = $("<li>");
            clueRef.append($("<strong>").text(clueAnchor));
            clueRef.append(clue || word);
            clueRef.append($("<small>").text(word));
            $("#" + direction + " .list").append(clueRef);
        });

        $("#add-clue input").val("");
    });
});

btn.click(() => {
    btn.attr("disabled", true);
    btn.text('↺ Loading ...');
    alertElem.show();
    answerButtonsElem.empty();
    questionHeadingElem.empty();

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
            game.addWord(word, function(error, clueAnchor, direction) {
                if (error) {
                    return;
                }
                var clueRef = $("<li>");
                clueRef.append($("<strong>").text(clueAnchor));
                clueRef.append(clue || word);
                clueRef.append($("<small>").text(word));
                $("#" + direction + " .list").append(clueRef);
            });

            $("#add-clue input").val("");
        }



        alertElem.hide();

        btn.attr("disabled", false);
        btn.text(btnTextOriginal);



    });
});

function shuffle(array) {
    var currentIndex = array.length,
        temporaryValue, randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}