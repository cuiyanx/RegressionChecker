const puppeteer = require("puppeteer-core");
const csv = require("../node_modules/fast-csv");
const execSync = require("child_process").execSync;
const cheerio = require("cheerio");
const fs = require("fs");
const os = require("os");

var outputPath, sourceHTMLPath;
if (os.type() == "Windows_NT") {
    outputPath = ".\\output";
    sourcePath = outputPath + "\\source";
    sourceHTMLPath = sourcePath + "\\source.html";
} else {
    outputPath = "./output";
    sourcePath = outputPath + "/source";
    sourceHTMLPath = sourcePath + "/source.html";
}

if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
}

if (!fs.existsSync(sourcePath)) {
    fs.mkdirSync(sourcePath);
}

var remoteURL = "https://brucedai.github.io/webnnt/test/index-local.html?prefer=fast";
var chromiumPath = "/usr/bin/chromium-browser-unstable";
var chromeOption = {
    headless: false,
    devtools: false,
    defaultViewport: null,
    timeout: 0,
    executablePath: chromiumPath,
    args: [
        "--disable-features=WebML"
    ]
};

(async function() {
    const browser = await puppeteer.launch(chromeOption);
    const page = await browser.newPage();
    await page.goto(remoteURL);
    await page.waitForFunction(function() {return window.mochaFinish}, {timeout: 200000}).then(async function() {
        console.log("All test case finished!");

        await page.evaluate(function() {return document.documentElement.outerHTML}).then(async function(html) {
            console.log("dowload source html to " + sourceHTMLPath);

            sourceHTML = html;
            fs.createWriteStream(sourceHTMLPath, {flags: "w"}).write(sourceHTML);
        }).catch(function(err) {
            throw err;
        });
    }).catch(function(err) {
        if (err.message.search("session deleted because of page crash") != -1) {
            console.log("remote URL is crashed");
        } else {
            throw err;
        }
    });

    var $ = cheerio.load(sourceHTML);
    var getSuiteName = function(suiteElement) {
        return $(suiteElement).children("h1").children("a").text();
    }

    var checkSuiteOrCase = function(suiteElement) {
        let checkPoint = "case";
        $(suiteElement).children("ul").children().each(function(i, element) {
            if ($(element).attr("class") === "suite") checkPoint = "suite";
        });

        return checkPoint;
    }

    var getCaseStatus = function(caseElement) {
        let caseStatus = $(caseElement).attr("class");
        let resultStatus = null;
        if (caseStatus == "test pass pending") {
            resultStatus = "N/A";
        } else if (caseStatus == "test pass fast" || caseStatus == "test pass slow" || caseStatus == "test pass medium") {
            resultStatus = "Pass";
        } else if (caseStatus == "test fail") {
            resultStatus = "Fail";
        } else {
            throw new Error("not support case status");
        }

        return resultStatus;
    }

    var getCaseName = function(caseElement) {
        let caseName = $(caseElement).children("h2").text();
        let length = caseName.length - 1;
        $(caseElement).children("h2").children().each(function(i, element) {
            length = length - $(element).text().length;
        });
        return caseName.slice(0, length).trim();
    }

    // title suite
    $("#mocha-report").children(".suite").each(function(i, titleElement) {
        let titleName = getSuiteName(titleElement);
        console.log(titleName);

        if (checkSuiteOrCase(titleElement) == "case") {
            let moduleName = titleName;
            console.log("  " + moduleName);

            // test case
            $(titleElement).children("ul").children("li").each(function(j, caseElement) {
                let caseStatus = getCaseStatus(caseElement);
                let caseName = getCaseName(caseElement);
                console.log("      " + caseStatus + ": " + caseName);
            });
        } else {
            // module suite
            $(titleElement).children("ul").children(".suite").each(function(j, moduleElement) {
                let moduleName = getSuiteName(moduleElement).split("#")[1];
                console.log("  " + moduleName);

                if (checkSuiteOrCase(moduleElement) == "case") {
                    // test case
                    $(moduleElement).children("ul").children("li").each(function(j, caseElement) {
                        let caseStatus = getCaseStatus(caseElement);
                        let caseName = getCaseName(caseElement);
                        console.log("      " + caseStatus + ": " + caseName);
                    });
                }
            });
        }
    });
})().then(function() {
    console.log("checking chromium code is completed");
}).catch(function(err) {
    console.log("console", err);
});
