var rusalph = "аАбБвВгГдДеЕёЁжЖзЗиИйЙкКлЛмМнНоОпПрРсСтТуУфФхХцЦчЧшШщЩъЪыЫьЬэЭюЮяЯ"
var vowels = "аяэеоуюиыАЯЭЕОУЮИЫ"
var masterstressdict = {}
var searchtext = $("#russiantext").val()

/**GENERAL FLOW OF EXTENSION LOGIC
 * 1) USER ENTERS TEXT IN RUSSIAN IN POPUP.HTML
 * 
 * 2) POPUP.JS DETERMINES WHETHER ANY RUSSIAN WORDS NEED STRESS
 * 
 * 3) POPUP.JS QUERIES STORAGE FOR STRESSES OF WORDS AND SENDS RESULTS TO CONTENT.JS
 *    WITH A FLAG TO INDICATE WHETHER ANY WORDS NOT IN STORAGE NEED STRESS 
 * 
 * 4) IF NO OTHER WORDS NEED STRESS, CONTENT.JS USES THE FETCHED STRESSES TO GENERATE
 *    THE STRESSED VERSION OF THE TEXT SEARCHED BY THE USER AND POPULATES THE CURRENT
 *    TAB'S HTML WITH THIS RESULT
 * 
 * 5) ALTERNATIVELY, IF ANY WORDS NEEDING STRESS ARE NOT IN STORAGE, POPUP.JS SENDS AN ARRAY
 *    CONTAINING THESE WORDS TO BACKGROUND.JS
 * 
 * 6) BACKGROUND.JS FETCHES THE ГДЕ-УДАРЕНИЕ.РФ PAGE FOR EACH WORD REQUIRING STRESS
 *    AND SENDS THE RESULTANT HTML TO CONTENT.JS FOR PROCESSING
 * 
 * 7) CONTENT.JS ISOLATES THE STRESS FOR EACH WORD FROM THE HTML AND CREATES A
 *    "DICTIONARY" OBJECT WHERE EACH KEY IS A WORD NEEDING STRESS AND EACH VALUE IS AN ARRAY
 *    CONTAINING THE STRESS OPTIONS FOR THAT WORD
 * 
 * 8) ONCE CONTENT.JS HAS PROCESSED THE HTML FOR ALL WORDS, IT USES THE RESULTANT
 *    DICTIONARY (BASED ON ANY WORDS PULLED FROM THE STORAGE AND THE SCRAPING RESULTS)
 *    TO GENERATE THE STRESSED VERSION OF THE TEXT SEARCHED BY THE USER AND REPLACE 
 *    THE CURRENT TAB'S HTML WITH THIS RESULT (AS IN STEP 4) */


//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
//=========  HELPER METHODS  ============
//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
/**
 * takes a string and returns true if the string contains at least one letter of the Russian alphabet
 */
function isRussian(word) {
    var ruslettercount = 0
    for (let i = 0, len = word.length; i < len; i++) {
        if (rusalph.includes(word[i])) {
            ruslettercount ++;
        }
    }
    if (ruslettercount > 0) {
        return true
    }
    return false
}

/**
 * takes a string; returns false if the string contains ё or Ё, false if the string contains one or fewer russian vowels, or true if the function contains more than one Russian vowel other than ё.
 */
function needsStress(word) {
    var vowelcount = 0
    if (word.includes("ё") || word.includes("Ё")){
        return false
    }
    for (let i = 0, len = word.length; i < len; i++) {
        if (vowels.includes(word[i])) {
            vowelcount ++;
        }
    }
    if (vowelcount > 1) {
        return true
    }
    return false
}

/** takes a string; removes all instances of ,.!?/\'"—«»;:()[]… */
function stripPunct(word) {
    return word.replace(/[,.!?/\\\'\"—«»;:\(\)\[\]…\n]/g,"")
}

/** takes a string; removes all upper case and lower case letters of the English alphabet */
function stripEnglish(word) {
    return word.replace(/[a-z]/ig, "")
}

/**
 * takes a string; separates the string into an array by spaces;
 * then pushes the words (array elements) to a new array if they contain two or more Russian vowels and do not contain ё.
 * Returns this array of words needing stress.
 */
function validate(txt) {
    var splittxt = txt.split(" ")
    var resultsList = []
    for (let i = 0, len = splittxt.length; i < len; i++) {
        if (isRussian(splittxt[i])) {
            var word = stripEnglish(stripPunct(splittxt[i]))
            if (needsStress(word)){
                resultsList.push(word)
            }
        }
    }
    return resultsList
}

/** takes an object containing specifications for sending a message to content.js;
 *  sends the message based on the specified object */
async function sendmsgContentJS(dataobj) {
    let queryoptions = {active: true, currentWindow:true};
    let tab = await chrome.tabs.query(queryoptions)
    console.log(tab)
    chrome.tabs.sendMessage(tab[0].id, dataobj, function(response){
        console.log("sending msg to content.js")
    })
}

//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
//&&&& BUTTON ON CLICK FUNCTIONALITY &&&&&&&
//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&

/** function which clears storage when pressed */
$(function(){
    $("#erase").on("click", function(){
        verify = confirm("Are you sure you wish to clear the stress database? This will erase all stored stresses. This cannot be undone.")
        if (verify) {
            chrome.storage.local.clear()
        }
    })
})
/** function which runs when button is pressed;
 *  takes text input, determines which words may need stress;
 *  queries storage to see if these words have previously been searched, and if so, fetches the results and sends them to content.js;
 *  sends list of any remaining words needing stress to background.js for further processing */
$(function(){
    $("#submit").on("click", async function(){
        // chrome.storage.local.clear()
        // ensure there is at least one word requiring stress in the input
        searchtext = $("#russiantext").val()
        var results = validate(searchtext)
        if (results.length < 1) {
            alert("No words needing stress detected!")
        } else {
            //send search text to content.js
            usertextdata = {type: "usertext", usertext: searchtext}
            sendmsgContentJS(usertextdata)
            //try to fetch stresses from storage; if there's an entry for a given word, add it to the masterstressdict;
            //send the list of any remaining words needing stress to background.js for further processing
            loopquerystorage(results).then(resultlist => {
                if (Object.keys(resultlist[1]).length != 0) {
                    for (key in resultlist[1]){
                        masterstressdict[key] = resultlist[1][key]
                    }
                    // send any stresses pulled from storage to content.js
                    tocontentjs = {type: "fromstorage", fromstorage: masterstressdict}
                    if (resultlist[0].length > 0){
                        tocontentjs["toscrape"] = true
                    } else {
                        tocontentjs["toscrape"] = false
                    }
                    sendmsgContentJS(tocontentjs)
                }
                //if there are words that weren't in strorage that need stress
                // send the array of such words to background.js for further processing.
                if (resultlist[0].length > 0) {
                    $("#russiantextlbl").html("Searching stress for words...<br/><br/>Please be patient, there is a three second delay built into the search for each word to ensure the website you're querying doesn't ban your IP address for too many concurrent requests.")
                    chrome.runtime.sendMessage({type: "toStressArray", data: resultlist[0]})
                    console.log("sending message to background")
                    }
            })
        }
    })
})

/** takes an array; attempts to fetch each of its members from storage; returns an array with two elements:
 * an array of the elements which weren't in storage;
 * and an object containing the results of the queries which were in storage*/
async function loopquerystorage(somelist){
    returnobj = {}
    needstressarray = []
    for (let q = 0; q < somelist.length; q++) {
        // loop through list and await the results of async call
        await querystorage(somelist[q]).then(response => {
            // if query successful, grab stored data and put it in return obj
            returnobj[somelist[q]] = response
        },
        (error)=> {
            //if query fails, add word to list of words that need to be fetched
            needstressarray.push(somelist[q])
        })
        
    }
    return [needstressarray, returnobj]
}

/** takes a string; attempts to fetch the string from storage;
 * returns null if it fails or the value for the word if it succeeds  */
async function querystorage(someword){
    return new Promise((resolve, reject) =>{
        chrome.storage.local.get([someword], function(result){
            //test to see if word in db
            if (result[someword] === undefined) {
                // if not in db, return null
                reject(null)
            } else {
                // if in db, return entry
                console.log("successfully fetched " + result[someword])
                resolve(result[someword])
            }
        })
    })
}

/** listen for the allfinished signal from content.js to update the popup window */
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse){
        if (request.type === "allfinished") {
            $("#russiantextlbl").html("All finished! The results should be visible in the tab which was active when you ran the extension.")
        }
    }
)