newstressdict = {}
nostresserrors = []
searchtext = ''


/** parses html content sent from background.js;
 * isolates target word and swaps bold tags around stressed vowel for accented stress marker;
 * stores result (if stress is found); sends the results to popup.js, where they are
 * the full search text is processed (replacing words needing stresses based on both
 * stresses pulled from где-ударение.рф this session and previously stored stresses);
 * replaces the active tab's head and body with html where the results can easily be edited/copied*/
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse){
        if (request.type === "htmlcontent") {
            console.log("message rec'd from background.js")
            // parse html content (page from где-ударение.рф which was sent by background.js)
            const parser = new DOMParser();
            const stresspage = parser.parseFromString(request.data, "text/html")
            //select divs with class "rule", which contain stress of searched word
            stressOptsHTML = stresspage.getElementsByClassName("rule")
            //stressoptions array will contain possible stresses for word
            stressoptions = []
            tarword = request.word
            for (j = 0; j < stressOptsHTML.length; j++) {
                // function will add stress each stress option as applicable
                stressoptions.push(getStress(stressOptsHTML[j].innerHTML, request.uppercase))
            }
            // if no stress options (i.e., word not found), simply add the unstressed word to the stressoptions array
            // otherwise, add the word and stress options to storage
            if (stressoptions.length === 0) {
                nostresserrors.push(tarword)
                stressoptions.push(tarword)
            } else {
                tostore = {}
                tostore[tarword] = stressoptions
                chrome.storage.local.set(tostore, function(){
                    console.log("storing " + tarword + ": " + stressoptions)
                })
            }
            newstressdict[tarword] = stressoptions
            if (request.last) {
                //Gen replacement text and populate html
                replacementtext = genreplacementtxt()
                populateHTML(replacementtext, nostresserrors)
            }
            sendResponse({message: "received content.js"})
        }
    }
)

/** listener for words fetched from storage */
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse){
        if (request.type === "fromstorage") {
            newstressdict = request.fromstorage
            if (! request.toscrape) {
                replacementtext = genreplacementtxt()
                populateHTML(replacementtext, [])
            }
            sendResponse("fromstorage message received")
        }
    }
)

/** listener for usersearch text */
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse){
        if (request.type === "usertext"){
            searchtext = request.usertext
            sendResponse("received search text")
        }
    }
)

/** takes the original searched text (string) and replaces the word elemnts with their stressed counterparts;
 * returns the resulting string
 */
 function genreplacementtxt() {
    editedtext = searchtext
    //javascript doesn't seem to support word boundaries in regular
    //expressions for cyrillic words very well. To minimize errors in
    // global replacement of strings, I opted to replace the longest
    // words first. I am hoping that adding accents to longer words
    // might minimize the accidental replacement of substrings, but
    // this is certainly not a fool proof method. I tried the
    // string interpolated regexp `\\b${k}\\b` in the new RegExp
    // below, but that regex failed the .test method on strings
    // that clearly contained the target word.
    dictkeys = Object.keys(newstressdict)
    dictkeys.sort(function(a, b){
        return b.length - a.length
    })
    for (p=0; p < dictkeys.length; p++) {
        let k = dictkeys[p]
        if (newstressdict[k].length > 1) {
            replacementword = newstressdict[k].join('\\')
        } else {
            replacementword = newstressdict[k][0]
        }

        let re = new RegExp(k, 'gu')
        console.log("replacing " + re + " with " + replacementword)
        editedtext = editedtext.replace(re, replacementword)
        console.log(re.test(editedtext))
    }
    
    // $("#russiantextlbl").text("Enter Russian text:")
    return editedtext
}


/** replace the current tab's head/body with content that makes the resultant text with stresses marked easy to edit/copy */
function populateHTML(text, errors) {
    editedtext = text
    var p = document.createElement("p")
    p.innerHTML = "If multiple possible stresses were found for a given word, the options will appear separated by a backslash."
    var p1 = document.createElement("p")
    errorsstring = ""
    if (errors.length > 0) {
        errorsstring = errors.join(" ")
    }
    p1.innerHTML = "Stress not found errors (if any): <span style='font-weight:bold'>" + errorsstring + "</span>"
    nostresserrors = []
    var x = document.createElement("textarea")
    x.setAttribute("cols", "40")
    x.setAttribute("rows", "5")
    x.setAttribute("id", "textbox")
    x.innerHTML = editedtext
    style = document.createElement("link")
    style.setAttribute("href", "https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/css/bootstrap.min.css")
    style.setAttribute("rel", "stylesheet")
    style.setAttribute("integrity", "sha384-Zenh87qX5JnK2Jl0vWa8Ck2rdkQ2Bzep5IDxbcnCeuOxjzrPF/et3URy9Bv1WTRi")
    style.setAttribute("crossorigin", "anonymous")
    var p2 = document.createElement("p")
    p2.innerHTML = "а́ - я́ - э́ - е́ - и́ - ы́ - у́ - ю́ - о́ - (for ease of copying if inserting stresses manually)"
    var btncopy = document.createElement("button")
    btncopy.setAttribute("type", "button")
    btncopy.setAttribute("class", "btn btn-primary")
    btncopy.innerHTML = "Copy Text"
    btncopy.setAttribute("id", "btncopy")
    var btnleave = document.createElement("button")
    btnleave.setAttribute("type", "button")
    btnleave.setAttribute("class", "btn btn-secondary")
    btnleave.innerHTML = "Exit"
    btnleave.setAttribute("id", "btnleave")
    var br = document.createElement("br")
    var div = document.createElement("div")
    div.setAttribute("id", "resultsmodal")
    div.setAttribute("style", "padding:4px")
    div.append(p)
    div.append(p1)
    div.append(x)
    div.append(br)
    div.append(p2)
    div.append(btncopy)
    div.append(btnleave)
    document.head.innerHTML = ''
    document.head.append(style)
    document.body.innerHTML = ''
    document.body.insertBefore(div, document.body.firstChild)
    document.getElementById("btncopy").addEventListener('click', function(){
        tocopy = document.getElementById("textbox").value
        navigator.clipboard.writeText(tocopy).then(() =>{
            alert("Text copied to clipboard!")
        })
    })
    document.getElementById("btnleave").addEventListener('click', function(){
        location.reload();
    })
    chrome.runtime.sendMessage({type: "allfinished"})
}

stressed_vowels = {
    'а': 'а́',
    'я': 'я́',
    'э': 'э́',
    'е': 'е́',
    'и': 'и́',
    'ы': 'ы́',
    'у': 'у́',
    'ю': 'ю́',
    'о': 'о́',
    'ё': 'ё'
}

/** takes a string and a bool (upper)
 *  - finds the Russian vowel with bold tags around it and replaces that vowel with its stressed counterpart */
function getStress(HTMLString, upper) {
    //split string by spaces and find element with <b> tag
    wordlist = HTMLString.split(" ")
    for (i = 0; i < wordlist.length; i++) {
        if (wordlist[i].includes("<b>")) {
            word = wordlist[i].toLowerCase();
            //find index of stressed vowel
            target = word.indexOf(">") + 1
            // create new string where this vowel is replaced by version with stress marker
            stressedword = word.slice(0, target) + stressed_vowels[word[target]] + word.slice(target + 1)
            // remove bold tags
            returntext = stressedword.replace("<b>", "").replace("</b>", "")
            if (upper) {
                return stripPunct(returntext.charAt(0).toUpperCase() + returntext.slice(1))
            } else {
                return stripPunct(returntext)
            }
            
        }
    }
}

function stripPunct(word) {
    return word.replace(/[,.!?/\\\'\"—«»;:\(\)\[\]…]/g,"")
}