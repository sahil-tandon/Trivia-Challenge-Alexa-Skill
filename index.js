"use strict";

var ANSWER_COUNT = 3; // number of answer options for each trivia question.
var GAME_LENGTH = 3;  // total number of questions to be asked in a trivia game.
var GAME_STATES = {
    TRIVIA: "_TRIVIAMODE",
    START: "_STARTMODE",
    HELP: "_HELPMODE"
};
var questions = require("./questions");  //import questions set

var languageString = {
    "en-US": {
        "translation": {
            "QUESTIONS_GEOGRAPHY" : questions["QUESTIONS_GEOGRAPHY"],
            "QUESTIONS_GK" : questions["QUESTIONS_GK"],
            "QUESTIONS_SCIENCE" : questions["QUESTIONS_SCIENCE"],
            "GAME_NAME" : "Trivia Challenge",
            "HELP_MESSAGE": "I will ask you %s multiple choice questions. Respond with the number of the answer option you feel is correct." +
            "For example, say one, two or three. To start a new game at any time, say, start game.",
            "REPEAT_QUESTION_MESSAGE": "To repeat the last question, say, repeat.",
            "ASK_MESSAGE_START": "Would you like to start playing?",
            "HELP_REPROMPT": "To give an answer to a question, respond with the answer option number of your choice. ",
            "STOP_MESSAGE": "Would you like to continue playing?",
            "CANCEL_MESSAGE": "Ok, let\'s play again soon.",
            "NO_MESSAGE": "Ok, we\'ll play again sometime. Goodbye!",
            "TRIVIA_UNHANDLED": "Try saying a number between 1 and %s",
            "HELP_UNHANDLED": "Say yes to keep playing, or no to end the game.",
            "START_UNHANDLED": "Say start to start a new game.",
            "NEW_GAME_MESSAGE": "Welcome to %s. ",
            "WELCOME_MESSAGE": "Alright! I will ask you %s %s questions, try to get as many right as you can. " +
            "Just say the number of the answer option you feel is correct. Let\'s begin! ",
            "ANSWER_CORRECT_MESSAGE": "correct. ",
            "ANSWER_WRONG_MESSAGE": "wrong. ",
            "CORRECT_ANSWER_MESSAGE": "The correct answer is %s: %s. ",
            "ANSWER_IS_MESSAGE": "That answer is ",
            "TELL_QUESTION_MESSAGE": "Question %s. %s ",
            "GAME_OVER_MESSAGE": "You got %s out of %s questions correct. Thank you for playing Trivia Challenge!",
            "SCORE_IS_MESSAGE": "Your score is %s. ",
            "CHOOSE_TOPIC_MESSAGE": "Please choose a topic to begin: Science, General Knowledge, Mathematics, or Geography.",
            "BLAH_MESSAGE": "Okay, i'll repeat!"
        }
    }
};

var Alexa = require("alexa-sdk");
var APP_ID = undefined;

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    alexa.resources = languageString;
    alexa.registerHandlers(newSessionHandlers, startStateHandlers, triviaStateHandlers, helpStateHandlers);
    alexa.execute();
};

var newSessionHandlers = {
    "LaunchRequest": function () {
        this.handler.state = GAME_STATES.START;
        var speechOutput = this.t("NEW_GAME_MESSAGE", this.t("GAME_NAME")) + this.t("CHOOSE_TOPIC_MESSAGE");
        var repromptText = this.t("CHOOSE_TOPIC_MESSAGE");
        this.emit(":ask", speechOutput, repromptText);
    },
    "ChooseTopic": function () {
        this.handler.state = GAME_STATES.START;
        this.emitWithState("startGame", true);
    },
    "AMAZON.StartOverIntent": function() {
        this.handler.state = GAME_STATES.START;
        this.emitWithState("startGame", true);
    },
    "AMAZON.HelpIntent": function() {
        this.handler.state = GAME_STATES.HELP;
        this.emitWithState("helpTheUser", true);
    },
    "Unhandled": function () {
        var speechOutput = this.t("START_UNHANDLED");
        this.emit(":ask", speechOutput, speechOutput);
    }
};

var startStateHandlers = Alexa.CreateStateHandler(GAME_STATES.START, {
    "ChooseTopic": function () {
        this.handler.state = GAME_STATES.START;        
        this.emitWithState("startGame", true);
    },
    "startGame": function (newGame) {        
        var topicSlot = this.event.request.intent.slots.Topic;
        var topicName;
        var translatedQuestions;
        if (topicSlot && topicSlot.value) {
            topicName = topicSlot.value.toString().toLowerCase();
        }

        if(topicName=="science"){
            translatedQuestions = this.t("QUESTIONS_SCIENCE");
        }
        else if(topicName=="general knowledge"){
            translatedQuestions = this.t("QUESTIONS_GK");
        }
        else if(topicName=="geography"){
            translatedQuestions = this.t("QUESTIONS_GEOGRAPHY");
        }        
        else if(topicName=="mathematics"){
            translatedQuestions = this.t("QUESTIONS_MATHEMATICS");
        }

        var speechOutput = this.t("WELCOME_MESSAGE", GAME_LENGTH.toString(), topicName);
        
        var gameQuestions = populateGameQuestions(translatedQuestions);
        var correctAnswerIndex = Math.floor(Math.random() * (ANSWER_COUNT));
        var roundAnswers = populateRoundAnswers(gameQuestions, 0, correctAnswerIndex, translatedQuestions);
        var currentQuestionIndex = 0;
        var spokenQuestion = Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0];
        var repromptText = this.t("TELL_QUESTION_MESSAGE", "1", spokenQuestion);

        for (var i = 0; i < ANSWER_COUNT; i++) {
            repromptText += (i+1).toString() + ". " + roundAnswers[i] + ". ";
        }

        speechOutput += repromptText;

        Object.assign(this.attributes, {
            "speechOutput": repromptText,
            "repromptText": repromptText,
            "currentQuestionIndex": currentQuestionIndex,
            "correctAnswerIndex": correctAnswerIndex + 1,
            "questions": gameQuestions,
            "score": 0,
            "topicName": topicName,
            "correctAnswerText": translatedQuestions[gameQuestions[currentQuestionIndex]][Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0]][0]
        });
        
        this.handler.state = GAME_STATES.TRIVIA;
        this.emit(":askWithCard", speechOutput, repromptText, this.t("GAME_NAME"), repromptText);
    }
});

var triviaStateHandlers = Alexa.CreateStateHandler(GAME_STATES.TRIVIA, {
    "AnswerIntent": function () {
        handleUserGuess.call(this, false);
    },
    "DontKnowIntent": function () {
        handleUserGuess.call(this, true);
    },
    "AMAZON.StartOverIntent": function () {
        this.handler.state = GAME_STATES.START;
        this.emitWithState("startGame", false);
    },
    "AMAZON.RepeatIntent": function () {
        this.emit(":ask", this.t("BLAH_MESSAGE") + this.attributes["speechOutput"], this.attributes["repromptText"]);
    },
    "AMAZON.HelpIntent": function () {
        this.handler.state = GAME_STATES.HELP;
        this.emitWithState("helpTheUser", false);
    },
    "AMAZON.StopIntent": function () {
        this.handler.state = GAME_STATES.HELP;
        var speechOutput = this.t("STOP_MESSAGE");
        this.emit(":ask", speechOutput, speechOutput);
    },
    "AMAZON.CancelIntent": function () {
        this.emit(":tell", this.t("CANCEL_MESSAGE"));
    },
    "Unhandled": function () {
        var speechOutput = this.t("TRIVIA_UNHANDLED", ANSWER_COUNT.toString());
        this.emit(":ask", speechOutput, speechOutput);
    },
    "SessionEndedRequest": function () {
        console.log("Session ended in trivia state: " + this.event.request.reason);
    }
});

var helpStateHandlers = Alexa.CreateStateHandler(GAME_STATES.HELP, {
    "helpTheUser": function (newGame) {
        var askMessage = newGame ? this.t("ASK_MESSAGE_START") : this.t("REPEAT_QUESTION_MESSAGE") + this.t("STOP_MESSAGE");
        var speechOutput = this.t("HELP_MESSAGE", GAME_LENGTH) + askMessage;
        var repromptText = this.t("HELP_REPROMPT") + askMessage;
        this.emit(":ask", speechOutput, repromptText);
    },
    "AMAZON.StartOverIntent": function () {
        this.handler.state = GAME_STATES.START;
        this.emitWithState("startGame", false);
    },
    "AMAZON.RepeatIntent": function () {
        var newGame = (this.attributes["speechOutput"] && this.attributes["repromptText"]) ? false : true;
        this.emitWithState("helpTheUser", newGame);
    },
    "AMAZON.HelpIntent": function() {
        var newGame = (this.attributes["speechOutput"] && this.attributes["repromptText"]) ? false : true;
        this.emitWithState("helpTheUser", newGame);
    },
    "AMAZON.YesIntent": function() {
        if (this.attributes["speechOutput"] && this.attributes["repromptText"]) {
            this.handler.state = GAME_STATES.TRIVIA;
            this.emitWithState("AMAZON.RepeatIntent");
        } else {
            this.handler.state = GAME_STATES.START;
            this.emitWithState("startGame", false);
        }
    },
    "AMAZON.NoIntent": function() {
        var speechOutput = this.t("NO_MESSAGE");
        this.emit(":tell", speechOutput);
    },
    "AMAZON.StopIntent": function () {
        var speechOutput = this.t("STOP_MESSAGE");
        this.emit(":ask", speechOutput, speechOutput);
    },
    "AMAZON.CancelIntent": function () {
        this.handler.state = GAME_STATES.TRIVIA;
        this.emitWithState("AMAZON.RepeatIntent");
    },
    "Unhandled": function () {
        var speechOutput = this.t("HELP_UNHANDLED");
        this.emit(":ask", speechOutput, speechOutput);
    },
    "SessionEndedRequest": function () {
        console.log("Session ended in help state: " + this.event.request.reason);
    }
});

function handleUserGuess(userGaveUp) {
    var answerSlotValid = isAnswerSlotValid(this.event.request.intent);
    var speechOutput = "";
    var speechOutputAnalysis = "";
    var gameQuestions = this.attributes.questions;
    var correctAnswerIndex = parseInt(this.attributes.correctAnswerIndex);
    var currentScore = parseInt(this.attributes.score);
    var currentQuestionIndex = parseInt(this.attributes.currentQuestionIndex);
    var correctAnswerText = this.attributes.correctAnswerText;        
    var topicName = this.attributes.topicName;

    var translatedQuestions;
    if(topicName=="science"){
        translatedQuestions = this.t("QUESTIONS_SCIENCE");
    }
    else if(topicName=="general knowledge"){
        translatedQuestions = this.t("QUESTIONS_GK");
    }
    else if(topicName=="geography"){
        translatedQuestions = this.t("QUESTIONS_GEOGRAPHY");
    }
    else if(topicName=="mathematics"){
        translatedQuestions = this.t("QUESTIONS_MATHEMATICS");
    }

    if (answerSlotValid && parseInt(this.event.request.intent.slots.Answer.value) == this.attributes["correctAnswerIndex"]) {
        currentScore++;
        speechOutputAnalysis = this.t("ANSWER_CORRECT_MESSAGE");
    } else {
        if (!userGaveUp) {
            speechOutputAnalysis = this.t("ANSWER_WRONG_MESSAGE");
        }

        speechOutputAnalysis += this.t("CORRECT_ANSWER_MESSAGE", correctAnswerIndex, correctAnswerText);
    }

    if (this.attributes["currentQuestionIndex"] == GAME_LENGTH - 1) {
        speechOutput = userGaveUp ? "" : this.t("ANSWER_IS_MESSAGE");
        speechOutput += speechOutputAnalysis + this.t("GAME_OVER_MESSAGE", currentScore.toString(), GAME_LENGTH.toString());

        this.emit(":tell", speechOutput)
    } else {
        currentQuestionIndex += 1;
        correctAnswerIndex = Math.floor(Math.random() * (ANSWER_COUNT));
        var spokenQuestion = Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0];
        var roundAnswers = populateRoundAnswers.call(this, gameQuestions, currentQuestionIndex, correctAnswerIndex, translatedQuestions);
        var questionIndexForSpeech = currentQuestionIndex + 1;
        var repromptText = this.t("TELL_QUESTION_MESSAGE", questionIndexForSpeech.toString(), spokenQuestion);

        for (var i = 0; i < ANSWER_COUNT; i++) {
            repromptText += (i+1).toString() + ". " + roundAnswers[i] + ". "
        }

        speechOutput += userGaveUp ? "" : this.t("ANSWER_IS_MESSAGE");
        speechOutput += speechOutputAnalysis + this.t("SCORE_IS_MESSAGE", currentScore.toString()) + repromptText;

        Object.assign(this.attributes, {
            "speechOutput": repromptText,
            "repromptText": repromptText,
            "currentQuestionIndex": currentQuestionIndex,
            "correctAnswerIndex": correctAnswerIndex + 1,
            "questions": gameQuestions,
            "score": currentScore,
            "correctAnswerText": translatedQuestions[gameQuestions[currentQuestionIndex]][Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0]][0]
        });

        this.emit(":askWithCard", speechOutput, repromptText, this.t("GAME_NAME"), repromptText);
    }
}

function populateGameQuestions(translatedQuestions) {
    var gameQuestions = [];
    var indexList = [];
    var index = translatedQuestions.length;

    if (GAME_LENGTH > index){
        throw new Error("Invalid Game Length.");
    }

    for (var i = 0; i < translatedQuestions.length; i++){
        indexList.push(i);
    }
 
    for (var j = 0; j < GAME_LENGTH; j++){
        var rand = Math.floor(Math.random() * index);
        index -= 1;

        var temp = indexList[index];
        indexList[index] = indexList[rand];
        indexList[rand] = temp;
        gameQuestions.push(indexList[index]);
    }

    return gameQuestions;
}

function populateRoundAnswers(gameQuestionIndexes, correctAnswerIndex, correctAnswerTargetLocation, translatedQuestions) {
    var answers = [];
    var answersCopy = translatedQuestions[gameQuestionIndexes[correctAnswerIndex]][Object.keys(translatedQuestions[gameQuestionIndexes[correctAnswerIndex]])[0]].slice();
    var index = answersCopy.length;

    if (index < ANSWER_COUNT) {
        throw new Error("Not enough answers for question.");
    }

    for (var j = 1; j < answersCopy.length; j++){
        var rand = Math.floor(Math.random() * (index - 1)) + 1;
        index -= 1;

        var temp = answersCopy[index];
        answersCopy[index] = answersCopy[rand];
        answersCopy[rand] = temp;
    }

    for (var i = 0; i < ANSWER_COUNT; i++) {
        answers[i] = answersCopy[i];
    }
    temp = answers[0];
    answers[0] = answers[correctAnswerTargetLocation];
    answers[correctAnswerTargetLocation] = temp;
    return answers;
}

function isAnswerSlotValid(intent) {
    var answerSlotFilled = intent && intent.slots && intent.slots.Answer && intent.slots.Answer.value;
    var answerSlotIsInt = answerSlotFilled && !isNaN(parseInt(intent.slots.Answer.value));
    return answerSlotIsInt && parseInt(intent.slots.Answer.value) < (ANSWER_COUNT + 1) && parseInt(intent.slots.Answer.value) > 0;
}