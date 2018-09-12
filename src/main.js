const Builder = require("../node_modules/selenium-webdriver").Builder;
const By = require("../node_modules/selenium-webdriver").By;
const until = require("../node_modules/selenium-webdriver").until;
const Chrome = require("../node_modules/selenium-webdriver/chrome");
const csv = require("../node_modules/fast-csv");
const fs = require("fs");
const os = require("os");

var sys = os.type();
var platformRun = null;
if (sys == "Linux") {
    platformRun = "Linux";
} else if (sys == "Darwin") {
    platformRun = "Mac";
} else if (sys == "Windows_NT") {
    platformRun = "Windows";
}

var outputPath = "./output";
if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
}

var csvStream = csv.createWriteStream({headers: true}).transform(function(row) {return {
    "Feature": row.Feature,
    "Case Id": row.CaseId,
    "Test Case": row.TestCase,
    "BaseLine(Mac-MPS)": row.BLMMPS,
    "CheckResult(Mac-MPS)": row.CRMMPS,
    "BaseLine(Mac-BNNS)": row.BLMBNNS,
    "CheckResult(Mac-BNNS)": row.CRMBNNS,
    "BaseLine(Mac-WASM)": row.BLMWASM,
    "CheckResult(Mac-WASM)": row.CRMWASM,
    "BaseLine(Mac-WebGL2)": row.BLMWebGL2,
    "CheckResult(Mac-WebGL2)": row.CRMWebGL2,
    "BaseLine(Android-NNAPI)": row.BLANNAPI,
    "CheckResult(Android-NNAPI)": row.CRANNAPI,
    "BaseLine(Android-WASM)": row.BLAWASM,
    "CheckResult(Android-WASM)": row.CRAWASM,
    "BaseLine(Android-WebGL2)": row.BLAWebGL2,
    "CheckResult(Android-WebGL2)": row.CRAWebGL2,
    "BaseLine(Windows-clDNN)": row.BLWclDNN,
    "CheckResult(Windows-clDNN)": row.CRWclDNN,
    "BaseLine(Windows-WASM)": row.BLWWASM,
    "CheckResult(Windows-WASM)": row.CRWWASM,
    "BaseLine(Windows-WebGL2)": row.BLWWebGL2,
    "CheckResult(Windows-WebGL2)": row.CRWWebGL2,
    "BaseLine(Linux-WASM)": row.BLLWASM,
    "CheckResult(Linux-WASM)": row.CRLWASM,
    "BaseLine(Linux-WebGL2)": row.BLLWebGL2,
    "CheckResult(Linux-WebGL2)": row.CRLWebGL2
}});

var csvFilePath = outputPath + "/report-check-result.csv";
csvStream.pipe(fs.createWriteStream(csvFilePath));

var remoteURL, driver, backendModel;
var backendModels = [
    "Mac-MPS",
    "Mac-BNNS",
    "Mac-WASM",
    "Mac-WebGL2",
    "Android-NNAPI",
    "Android-WASM",
    "Android-WebGL2",
    "Windows-clDNN",
    "Windows-WASM",
    "Windows-WebGL2",
    "Linux-WASM",
    "Linux-WebGL2"
];

var TTFCCjson = JSON.parse(fs.readFileSync("./TTFCC.config.json"));
var andriodFlag = TTFCCjson.andriod;
var chromiumPath = TTFCCjson.chromiumPath;
var chromeOption = new Chrome.Options();

var totalPass = null;
var totalFail = null;
var checkTitle = null;
var checkModule = null;
var checkName = null;

var baseLineData = new Map();
var writeCSVData = new Map();

csv.fromPath("./baseline/unitTestsBaseline.csv").on("data", function(data){
    baseLineData.set(data[1], new Map(
        [
            ["Feature", data[0]],
            ["CaseId", data[1]],
            ["TestCase", data[2]],
            ["Mac-MPS", data[3]],
            ["Mac-BNNS", data[4]],
            ["Mac-WASM", data[5]],
            ["Mac-WebGL2", data[6]],
            ["Android-NNAPI", data[7]],
            ["Android-WASM", data[8]],
            ["Android-WebGL2", data[9]],
            ["Windows-clDNN", data[10]],
            ["Windows-WASM", data[11]],
            ["Windows-WebGL2", data[12]],
            ["Linux-WASM", data[13]],
            ["Linux-WebGL2", data[14]],
        ]
    ));
});

var debugFlag = false;
function TTFCClog (target, message) {
    if (target == "console") {
        console.log("TTFCC -- " + message);
    } else if (target == "debug") {
        if (debugFlag) console.log("TTFCC -- " + message);
    } else {
        throw new Error("Not support target '" + target + "'");
    }
}

(async function() {
    TTFCClog("console", "checking chromium code is start");

    var getInfo = async function(element, count, title, module) {
        return element.getAttribute("class").then(function(message) {
            let checkCaseStatus = null;
            if (message == "test pass pending") {
                checkCaseStatus = "N/A";
            } else if (message == "test pass fast" || message == "test pass slow" || message == "test pass medium") {
                checkCaseStatus = "Pass";
            } else if (message == "test fail") {
                checkCaseStatus = "Fail";
            } else {
                throw new Error("not support case status");
            }

            module = module + "/" + count;

            TTFCClog("debug", "'Feature': " + title);
            TTFCClog("debug", "'Case Id': " + module);
            TTFCClog("debug", "'Case Status': " + checkCaseStatus + "\n");

            let resultFlag = checkResult(backendModel, module, checkCaseStatus);
            if (resultFlag) {
                if (!writeCSVData.has(module)) {
                    writeCSVData.set(module, new Array());

                    writeCSVData.get(module)["Feature"] = title;
                    writeCSVData.get(module)["CaseId"] = module;
                    writeCSVData.get(module)["TestCase"] = baseLineData.get(module).get("TestCase");
                }

                let DataArray = writeCSVData.get(module);
                let baseLineStatus = baseLineData.get(module).get(backendModel);
                let name = baseLineData.get(module).get("TestCase");

                switch(backendModel) {
                    case "Mac-MPS":
                        DataArray["BLMMPS"] = baseLineStatus;
                        DataArray["CRMMPS"] = checkCaseStatus;
                        break;
                    case "Mac-BNNS":
                        DataArray["BLMBNNS"] = baseLineStatus;
                        DataArray["CRMBNNS"] = checkCaseStatus;
                        break;
                    case "Mac-WASM":
                        DataArray["BLMWASM"] = baseLineStatus;
                        DataArray["CRMWASM"] = checkCaseStatus;
                        break;
                    case "Mac-WebGL2":
                        DataArray["BLMWebGL2"] = baseLineStatus;
                        DataArray["CRMWebGL2"] = checkCaseStatus;
                        break;
                    case "Android-NNAPI":
                        DataArray["BLANNAPI"] = baseLineStatus;
                        DataArray["CRANNAPI"] = checkCaseStatus;
                        break;
                    case "Android-WASM":
                        DataArray["BLAWASM"] = baseLineStatus;
                        DataArray["CRAWASM"] = checkCaseStatus;
                        break;
                    case "Android-WebGL2":
                        DataArray["BLAWebGL2"] = baseLineStatus;
                        DataArray["CRAWebGL2"] = checkCaseStatus;
                        break;
                    case "Windows-clDNN":
                        DataArray["BLWclDNN"] = baseLineStatus;
                        DataArray["CRWclDNN"] = checkCaseStatus;
                        break;
                    case "Windows-WASM":
                        DataArray["BLWWASM"] = baseLineStatus;
                        DataArray["CRWWASM"] = checkCaseStatus;
                        break;
                    case "Windows-WebGL2":
                        DataArray["BLWWebGL2"] = baseLineStatus;
                        DataArray["CRWWebGL2"] = checkCaseStatus;
                        break;
                    case "Linux-WASM":
                        DataArray["BLLWASM"] = baseLineStatus;
                        DataArray["CRLWASM"] = checkCaseStatus;
                        break;
                    case "Linux-WebGL2":
                        DataArray["BLLWebGL2"] = baseLineStatus;
                        DataArray["CRLWebGL2"] = checkCaseStatus;
                        break;
                }

                TTFCClog("console", title + " - " + module + " - " + name);
                TTFCClog("console", checkCaseStatus + " : " + baseLineStatus);
            }
        });
    }

    var graspResult = async function() {
        await driver.findElements(By.xpath("//ul[@id='mocha-report']/li[@class='suite']")).then(function(arrayTitles) {
            for (let i = 0; i < arrayTitles.length; i++) {
                arrayTitles[i].findElement(By.xpath("./h1/a")).getText().then(function(message) {
                    let title = message;

                    arrayTitles[i].findElements(By.xpath("./ul/li[@class='suite']")).then(function(arrayModules) {
                        if (arrayModules.length === 0) {
                            let module = title;

                            arrayTitles[i].findElements(By.xpath("./ul/li[@class='test pass fast' or " +
                                                                 "@class='test pass slow' or " +
                                                                 "@class='test fail' or " +
                                                                 "@class='test pass pending' or " +
                                                                 "@class='test pass medium']")).then(async function(arrayCase) {
                                TTFCClog("debug", "title: " + title + "    module: " + module + "    case: " + arrayCase.length);

                                for (let k = 0; k < arrayCase.length; k++) {
                                    await getInfo(arrayCase[k], k + 1, title, module).then(function() {
                                        actions = actions + 1;
                                    });
                                }

                            });
                        } else {
                            for (let j = 0; j < arrayModules.length; j++) {
                                arrayModules[j].findElement(By.xpath("./h1/a")).getText().then(function(message) {
                                    let module = message.split("#")[1];

                                    arrayModules[j].findElements(By.xpath("./ul/li[@class='test pass fast' or " +
                                                                          "@class='test pass slow' or " +
                                                                          "@class='test fail' or " +
                                                                          "@class='test pass pending' or " +
                                                                          "@class='test pass medium']")).then(async function(arrayCase) {
                                        TTFCClog("debug", "title: " + title + "    module: " + module + "    case: " + arrayCase.length);

                                        for (let k = 0; k < arrayCase.length; k++) {
                                            await getInfo(arrayCase[k], k + 1, title, module).then(function() {
                                                actions = actions + 1;
                                            });
                                        }
                                    });
                                });
                            }
                        }
                    });
                });
            }
        });

        let actions = 0;
        let actionCount = 0;
        await driver.wait(function() {
            if (actionCount != actions) {
                actionCount = actions;
                TTFCClog("debug", ((totalPass >> 0) + (totalFail >> 0)) + " : " + actionCount);
            }

            return (actions == ((totalPass >> 0) + (totalFail >> 0)));
        }, 500000).catch(function() {
            throw new Error("failed to grasp all test result");
        });
    }

    var graspTotal = async function() {
        await driver.findElement(By.xpath("//ul[@id='mocha-stats']/li[@class='passes']//em")).getText().then(function(message) {
            totalPass = message;
            TTFCClog("console", "total pass: " + totalPass);
        });

        await driver.findElement(By.xpath("//ul[@id='mocha-stats']/li[@class='failures']//em")).getText().then(function(message) {
            totalFail = message;
            TTFCClog("console", "total fail: " + totalFail);
        });
    }

    var checkResult = function(backend, caseId, statusCheck) {
        if (!baseLineData.has(caseId)) {
            throw new Error("no match test case: " + caseId);
        } else {
            if (statusCheck === baseLineData.get(caseId).get(backend)) {
                return false;
            } else {
                return true;
            }
        }
    }

    for (let i = 0; i < backendModels.length; i++) {
        backendModel = backendModels[i];

        if (backendModel === "Mac-MPS") {
            if (platformRun === "Mac") {
                remoteURL = "https://brucedai.github.io/nt/testm/index-local.html?backend=mps";
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--enable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Mac-BNNS") {
            if (platformRun === "Mac") {
                remoteURL = "https://brucedai.github.io/nt/testm/index-local.html?backend=bnns";
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--enable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Mac-WASM") {
            if (platformRun === "Mac") {
                remoteURL = "https://brucedai.github.io/nt/test/index-local.html?backend=wasm";
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--disable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Mac-WebGL2") {
            if (platformRun === "Mac") {
                remoteURL = "https://brucedai.github.io/nt/test/index-local.html?backend=webgl2";
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--disable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Android-NNAPI") {
            if (andriodFlag) {
                remoteURL = "https://brucedai.github.io/nt/testa/index-local.html";
                chromeOption = chromeOption
                    .androidPackage("org.chromium.chrome")
                    .addArguments("--enable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Android-WASM") {
            if (andriodFlag) {
                remoteURL = "https://brucedai.github.io/nt/test/index-local.html?backend=wasm";
                chromeOption = chromeOption
                    .androidPackage("org.chromium.chrome")
                    .addArguments("--disable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Android-WebGL2") {
            if (andriodFlag) {
                remoteURL = "https://brucedai.github.io/nt/test/index-local.html?backend=webgl2";
                chromeOption = chromeOption
                    .androidPackage("org.chromium.chrome")
                    .addArguments("--disable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Windows-clDNN") {
            if (platformRun === "Windows") {
                TTFCClog("console", "will support Windows platform with clDNN backend");
                continue;
            } else {
                continue;
            }
        } else if (backendModel === "Windows-WASM") {
            if (platformRun === "Windows") {
                TTFCClog("console", "will support Windows platform with WASM backend");
                continue;
            } else {
                continue;
            }
        } else if (backendModel === "Windows-WebGL2") {
            if (platformRun === "Windows") {
                TTFCClog("console", "will support Windows platform with WebGL2 backend");
                continue;
            } else {
                continue;
            }
        } else if (backendModel === "Linux-WASM") {
            if (platformRun === "Linux") {
                remoteURL = "https://brucedai.github.io/nt/test/index-local.html?backend=wasm";
            } else {
                continue;
            }
        } else if (backendModel === "Linux-WebGL2") {
            if (platformRun === "Linux") {
                remoteURL = "https://brucedai.github.io/nt/test/index-local.html?backend=webgl2";
            } else {
                continue;
            }
        }

        driver = new Builder()
            .forBrowser("chrome")
            .setChromeOptions(chromeOption)
            .build();

        await driver.get(remoteURL);
        await driver.wait(until.elementLocated(By.xpath("//*[@id='mocha-stats']")), 100000).then(function() {
            TTFCClog("console", "open remote URL: " + remoteURL);
        }).catch(function() {
            throw new Error("failed to load web page");
        });
        await driver.sleep(10000);

        TTFCClog("console", "checking with '" + backendModel + "' backend is start");

        await graspTotal();

        TTFCClog("console", "checking....");

        await graspResult();

        await driver.sleep(2000);
        await driver.close();
        await driver.sleep(2000);

        TTFCClog("console", "checking with '" + backendModel + "' backend is completed");
    }

    for (var value of writeCSVData.values()) {
        csvStream.write(value);
    }

    csvStream.end();
})().then(function() {
    TTFCClog("console", "checking chromium code is completed");
    driver.quit();
}).catch(function(err) {
    TTFCClog("console", err);
    driver.quit();
});
