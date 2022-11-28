/** listen for a message from popup.js when the button is first pressed;
 * popup.js should send an array of words needing stress;
 * fetch the где-ударение.рф html for each word needing stress and send the
 * resulting html to content.js for futher processing 
*/
chrome.runtime.onMessage.addListener(
    async function(request, sender, sendResponse){
        if (request.type === "toStressArray") {
            // console.log("request.data" + request.data)
            for (let l = 0, len = request.data.length; l < len; l++){
                if (l === len - 1) {
                    last = true
                } else {
                    last = false
                }
                let searchword = request.data[l]
                var uppercase = false
                if (isUppercase(searchword)) {
                    uppercase = true
                }
                console.log("searching " + searchword)
                await getHTML(searchword, uppercase, last)
            }
            
            sendResponse({message: "received background.js"})
        }
    }
)

/** takes a string (listitem), a bool (uppercase), a bool (last);
 * requests the html page for listitem from где-ударение.рф;
 * last simply serves to track the progress through the array
 * of words needing stress (see listener above) as they make their
 * way through the flow of scripts.
 */
async function getHTML(listitem, uppercase, last) {
    await sleep(3000);
    fetch("https://где-ударение.рф/в-слове-" + listitem.toLowerCase()).then(function(response) {
                return response.text();
            }).then(function(html) {
                datatosend = {type: "htmlcontent", word: listitem, data: html, uppercase: uppercase, last:last}
                sendmsgContentJS(datatosend)
            })
}

/** delay function to make fetch requests politely spaced so IP doesn't get banned */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** helper method to send message with given data to content.js */
async function sendmsgContentJS(dataobj) {
    let queryoptions = {active: true, currentWindow:true};
    let tab = await chrome.tabs.query(queryoptions)
    console.log(tab)
    chrome.tabs.sendMessage(tab[0].id, dataobj, function(response){
        console.log("sending msg to content.js")
    })
}

/** Takes a string and returns true if the first letter is capitalized */
function isUppercase(word) {
    return /^\p{Lu}/u.test(word);
}