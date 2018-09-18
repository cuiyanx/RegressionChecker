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

var htmlPath = outputPath + "/report-check-result.html";

var htmlStream = fs.createWriteStream(htmlPath, {flags: "a"});
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

var baselinejson = JSON.parse(fs.readFileSync("./baseline/baseline.config.json"));
var versionChromium = baselinejson.Version.chromium;
var versionPolyfill = baselinejson.Version.polyfill;

var baseLineData = new Map();
var writeCSVData = new Map();
var pageData = new Map();
var pageDataTotal = new Map();
for (let i = 0; i < backendModels.length; i++) {
    pageData.set(backendModels[i], new Map([["pass2fail", new Array()], ["fail2pass", new Array()]]));
    pageDataTotal.set(backendModels[i], new Map([["Baseline", new Array(
        baselinejson[backendModels[i]]["total"],
        baselinejson[backendModels[i]]["pass"],
        baselinejson[backendModels[i]]["fail"],
        baselinejson[backendModels[i]]["block"],
        Math.round((baselinejson[backendModels[i]]["pass"] / baselinejson[backendModels[i]]["total"]) * 100).toString() + "%"
    )], ["grasp", new Array()]]));
}

var testBackends = new Array();
var crashData = new Array();
var graspData = new Array();

csv.fromPath("./baseline/unitTestsBaseline.csv").on("data", function(data){
    baseLineData.set(data[0] + "-" + data[1], new Map(
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

var continueFlag = false;
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
                graspData["block"] = graspData["block"] + 1
            } else if (message == "test pass fast" || message == "test pass slow" || message == "test pass medium") {
                checkCaseStatus = "Pass";
                graspData["pass"] = graspData["pass"] + 1
            } else if (message == "test fail") {
                checkCaseStatus = "Fail";
                graspData["fail"] = graspData["fail"] + 1
            } else {
                throw new Error("not support case status");
            }

            graspData["total"] = graspData["total"] + 1;
            module = module + "/" + count;

            TTFCClog("debug", "'Feature': " + title);
            TTFCClog("debug", "'Case Id': " + module);
            TTFCClog("debug", "'Case Status': " + checkCaseStatus + "\n");

            let resultFlag = checkResult(backendModel, title, module, checkCaseStatus);
            if (resultFlag) {
                if (!writeCSVData.has(title + "-" + module)) {
                    writeCSVData.set(title + "-" + module, new Array());

                    writeCSVData.get(title + "-" + module)["Feature"] = title;
                    writeCSVData.get(title + "-" + module)["CaseId"] = module;
                    writeCSVData.get(title + "-" + module)["TestCase"] = baseLineData.get(title + "-" + module).get("TestCase");
                }

                let DataArray = writeCSVData.get(title + "-" + module);
                let baseLineStatus = baseLineData.get(title + "-" + module).get(backendModel);
                let name = baseLineData.get(title + "-" + module).get("TestCase");

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

                if (baseLineStatus == "Pass" && checkCaseStatus == "Fail") {
                    pageData.get(backendModel).get("pass2fail").push([title, module + " - " + name]);
                } else {
                    pageData.get(backendModel).get("fail2pass").push([title, module + " - " + name]);
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
                TTFCClog("debug", baselinejson[backendModel]["total"] + " : " + actionCount);
            }

            return (actions == baselinejson[backendModel]["total"]);
        }, 500000).catch(function() {
            throw new Error("failed to grasp all test result");
        });
    }

    var checkResult = function(backend, title, module, statusCheck) {
        let caseId = title + "-" + module;
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

    var createHtmlHead = function() {
        let htmlDataHead = "\
  <head>\n\
    <meta charset='utf-8'>\n\
    <title>Summary by PR Submission Criteria Checking</title>\n\
    <style>\n\
    h2 {text-align:center}\n\
    .container {margin: 20px 20px}\n\
    .tab-menu {margin: 10px 0px -10px 0px;}\n\
    .tab-menu ul {height:30px;border-bottom:1px solid gray;list-style:none;padding-left:0;}\n\
    .tab-menu ul li {float:left;width:150px;margin-right:3px;color:#000;border:solid 1px gray;border-bottom:none; text-align:center;line-height:30px;}\n\
    .tab-menu ul li.active {background-color: #007bc7;color: #fff;}\n\
    .tab-menu ul li:hover {cursor: pointer;}\n\
    .tab-box div {display:none;}\n\
    .tab-box div.active {display:block;}\n\
    table {border: 1px solid #ddd; border-spacing:0;}\n\
    table tr th {border: 1px solid #ddd}\n\
    table tr td {border: 1px solid #ddd}\n\
    table tr.fail2pass {display:none;}\n\
    .warnning {color:red}\n\
    .pass {color:green}\n\
    .fail {color:red}\n\
    </style>\n\
    <script>\n\
      function tab1_click() {\n\
        document.getElementById('tab_menu2').classList.remove('active');\n\
        document.getElementById('tab_menu1').classList.add('active');\n\
        for ( let node of document.getElementsByClassName('pass2fail') ) {\n\
          node.style.display = 'table-row';\n\
        }\n\
        for ( let node of document.getElementsByClassName('fail2pass') ) {\n\
          node.style.display = 'none';\n\
        }\n\
      }\n\
      function tab2_click() {\n\
        document.getElementById('tab_menu1').classList.remove('active');\n\
        document.getElementById('tab_menu2').classList.add('active');\n\
        for ( let node of document.getElementsByClassName('pass2fail') ) {\n\
          node.style.display = 'none';\n\
        }\n\
        for ( let node of document.getElementsByClassName('fail2pass') ) {\n\
          node.style.display = 'table-row';\n\
        }\n\
      }\n\
    </script>\n\
  </head>\n";

        htmlStream.write(htmlDataHead);
    }

    var createHtmlBodyContainerVersion = function(space) {
        htmlStream.write(space + "<div>\n");
        htmlStream.write(space + "  <h2>Summary by PR Submission Criteria Checking</h2>\n");
        htmlStream.write(space + "  <hr />\n");
        htmlStream.write(space + "  <h3>Baseline Info:</h3>\n");
        htmlStream.write(space + "    <div>Chromium version: " + versionChromium + "</div>\n");
        htmlStream.write(space + "    <div>Webml-polyfill version: " + versionPolyfill + "</div>\n");
        htmlStream.write(space + "</div>\n");
    }

    var createHtmlBodyContainerWarnning = function(space) {
        if (crashData.length !== 0) {
            htmlStream.write(space + "<div class='warnning' id='option_div'>\n");
            htmlStream.write(space + "  <h3>[option]Warnning:</h3>\n");

            for (let i = 0; i < crashData.length; i++) {
                htmlStream.write(space + "  <p id='" + crashData[i] + "'>Crash happened when testing " +
                                 crashData[i] + ", please double check.</p>\n");
            }

            htmlStream.write(space + "</div>\n");
        }
    }

    var createHtmlBodyContainerResultMenu =  function(space) {
        htmlStream.write(space + "<div class='tab-menu'>\n");
        htmlStream.write(space + "  <ul>\n");
        htmlStream.write(space + "    <li class='active' id='tab_menu1' onclick='javascript:tab1_click()'>Pass2Fail</li>\n");
        htmlStream.write(space + "    <li id='tab_menu2' onclick='javascript:tab2_click()'>Fail2Pass</li>\n");
        htmlStream.write(space + "  </ul>\n");
        htmlStream.write(space + "</div>\n");
    }

    var createHtmlBodyContainerResultBoxTable =  function(space, backend) {
        htmlStream.write(space + "<table>\n");
        htmlStream.write(space + "  <thead>\n");
        htmlStream.write(space + "    <tr>\n");
        htmlStream.write(space + "      <th>Feature\n");
        htmlStream.write(space + "      </th>\n");
        htmlStream.write(space + "      <th>TestCase\n");
        htmlStream.write(space + "      </th>\n");
        htmlStream.write(space + "      <th>Baseline\n");
        htmlStream.write(space + "      </th>\n");
        htmlStream.write(space + "      <th>" + backend + "\n");
        htmlStream.write(space + "      </th>\n");
        htmlStream.write(space + "    </tr>\n");
        htmlStream.write(space + "  </thead>\n");
        htmlStream.write(space + "  <tbody>\n");

        if (pageData.get(backend).get("pass2fail").length == 0) {
            htmlStream.write(space + "    <tr class='pass2fail'>\n");
            htmlStream.write(space + "      <td colspan='4'>None changed\n");
            htmlStream.write(space + "      </td>\n");
            htmlStream.write(space + "    </tr>\n");
        } else {
            for (let i = 0; i < pageData.get(backend).get("pass2fail").length; i++) {
                htmlStream.write(space + "      <tr class='pass2fail'>\n");
                htmlStream.write(space + "        <td >" + pageData.get(backend).get("pass2fail")[i][0] + "\n");
                htmlStream.write(space + "        </td>\n");
                htmlStream.write(space + "        <td >" + pageData.get(backend).get("pass2fail")[i][1] + "\n");
                htmlStream.write(space + "        </td>\n");
                htmlStream.write(space + "        <td class='pass'>Pass\n");
                htmlStream.write(space + "        </td>\n");
                htmlStream.write(space + "        <td class='fail'>Fail\n");
                htmlStream.write(space + "        </td>\n");
                htmlStream.write(space + "      </tr>\n");
            }
        }

        if (pageData.get(backend).get("fail2pass").length == 0) {
            htmlStream.write(space + "    <tr class='fail2pass'>\n");
            htmlStream.write(space + "      <td colspan='4'>None changed\n");
            htmlStream.write(space + "      </td>\n");
            htmlStream.write(space + "    </tr>\n");
        } else {
            for (let i = 0; i < pageData.get(backend).get("fail2pass").length; i++) {
                htmlStream.write(space + "      <tr class='fail2pass'>\n");
                htmlStream.write(space + "        <td >" + pageData.get(backend).get("fail2pass")[i][0] + "\n");
                htmlStream.write(space + "        </td>\n");
                htmlStream.write(space + "        <td >" + pageData.get(backend).get("fail2pass")[i][1] + "\n");
                htmlStream.write(space + "        </td>\n");
                htmlStream.write(space + "        <td class='fail'>Fail\n");
                htmlStream.write(space + "        </td>\n");
                htmlStream.write(space + "        <td class='pass'>Pass\n");
                htmlStream.write(space + "        </td>\n");
                htmlStream.write(space + "      </tr>\n");
            }
        }

        htmlStream.write(space + "  </tbody>\n");
        htmlStream.write(space + "</table><br /><br />\n");
    }

    var createHtmlBodyContainerResultBoxTableTotal =  function(space) {
        htmlStream.write(space + "<table>\n");
        htmlStream.write(space + "  <thead>\n");
        htmlStream.write(space + "    <tr>\n");
        htmlStream.write(space + "      <th>\n");
        htmlStream.write(space + "      </th>\n");
        for (let i = 0; i < testBackends.length; i++) {
            htmlStream.write(space + "      <th>Baseline(" + testBackends[i] + ")\n");
            htmlStream.write(space + "      </th>\n");
            htmlStream.write(space + "      <th>" + testBackends[i] + "\n");
            htmlStream.write(space + "      </th>\n");
        }

        htmlStream.write(space + "    </tr>\n");
        htmlStream.write(space + "  </thead>\n");
        htmlStream.write(space + "  <tbody>\n");

        let TableTotalDataArray = ["Total", "Pass", "Fail", "Block", "PassRate%"];
        for (let i = 0; i < TableTotalDataArray.length; i++) {
            htmlStream.write(space + "    <tr>\n");
            htmlStream.write(space + "      <th>" + TableTotalDataArray[i] + "\n");
            htmlStream.write(space + "      </th>\n");

            for (let j = 0; j < testBackends.length; j++) {
                htmlStream.write(space + "      <td>" + pageDataTotal.get(testBackends[j]).get("Baseline")[i] + "\n");
                htmlStream.write(space + "      </td>\n");

                if (typeof pageDataTotal.get(testBackends[j]).get("grasp")[i] == "undefined") {
                    htmlStream.write(space + "      <td>\n");
                } else {
                    htmlStream.write(space + "      <td>" + pageDataTotal.get(testBackends[j]).get("grasp")[i] + "\n");
                }

                htmlStream.write(space + "      </td>\n");
            }

            htmlStream.write(space + "    </tr>\n");
        }

        htmlStream.write(space + "  </tbody>\n");
        htmlStream.write(space + "</table>\n");
    }

    var createHtmlBodyContainerResultBox =  function(space) {
        htmlStream.write(space + "<div class='tab-box'>\n");
        htmlStream.write(space + "  <div class='active' id='tab_box'>\n");

        for (let i = 0; i < testBackends.length; i++) {
            let flag = false;

            for (let j = 0; j < crashData.length; j++) {
                if (testBackends[i] == crashData[j]) flag = true;
            }

            if (crashData.length !== 0 && flag) {
                continue;
            } else {
                createHtmlBodyContainerResultBoxTable(space + "    ", testBackends[i]);
            }
        }

        createHtmlBodyContainerResultBoxTableTotal(space + "    ");

        htmlStream.write(space + "  </div>\n");
        htmlStream.write(space + "</div>\n");
    }

    var createHtmlBodyContainerResult = function(space) {
        htmlStream.write(space + "<h3>Result:</h3>\n");

        createHtmlBodyContainerResultMenu(space);
        createHtmlBodyContainerResultBox(space);
    }

    var createHtmlBodyContainer = function(space) {
        htmlStream.write(space + "<div class='container'>\n");

        createHtmlBodyContainerVersion(space + "  ");
        createHtmlBodyContainerWarnning(space + "  ");
        createHtmlBodyContainerResult(space + "  ");

        htmlStream.write(space + "</div>\n");
    }

    var createHtmlBody = function(space) {
        htmlStream.write(space + "<body>\n");

        createHtmlBodyContainer(space + "  ");

        htmlStream.write(space + "</body>\n");
    }

    var createHtmlFile = function() {
        fs.writeFileSync(htmlPath, "<!DOCTYPE html>\n");

        htmlStream.write("<html>\n");

        createHtmlHead();
        createHtmlBody("  ");

        htmlStream.write("</html>\n");
    }

    for (let i = 0; i < backendModels.length; i++) {
        backendModel = backendModels[i];
        graspData["total"] = 0;
        graspData["pass"] = 0;
        graspData["fail"] = 0;
        graspData["block"] = 0;
        continueFlag = false;

        if (backendModel === "Mac-MPS") {
            if (platformRun === "Mac") {
                testBackends.push("Mac-MPS");
                remoteURL = "https://brucedai.github.io/nt/testm/index-local.html?backend=mps";
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--enable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Mac-BNNS") {
            if (platformRun === "Mac") {
                testBackends.push("Mac-BNNS");
                remoteURL = "https://brucedai.github.io/nt/testm/index-local.html?backend=bnns";
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--enable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Mac-WASM") {
            if (platformRun === "Mac") {
                testBackends.push("Mac-WASM");
                remoteURL = "https://brucedai.github.io/nt/test/index-local.html?backend=wasm";
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--disable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Mac-WebGL2") {
            if (platformRun === "Mac") {
                testBackends.push("Mac-WebGL2");
                remoteURL = "https://brucedai.github.io/nt/test/index-local.html?backend=webgl2";
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--disable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Android-NNAPI") {
            if (andriodFlag) {
                testBackends.push("Android-NNAPI");
                remoteURL = "https://brucedai.github.io/nt/testa/index-local.html";
                chromeOption = chromeOption
                    .androidPackage("org.chromium.chrome")
                    .addArguments("--enable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Android-WASM") {
            if (andriodFlag) {
                testBackends.push("Android-WASM");
                remoteURL = "https://brucedai.github.io/nt/test/index-local.html?backend=wasm";
                chromeOption = chromeOption
                    .androidPackage("org.chromium.chrome")
                    .addArguments("--disable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Android-WebGL2") {
            if (andriodFlag) {
                testBackends.push("Android-WebGL2");
                remoteURL = "https://brucedai.github.io/nt/test/index-local.html?backend=webgl2";
                chromeOption = chromeOption
                    .androidPackage("org.chromium.chrome")
                    .addArguments("--disable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModel === "Windows-clDNN") {
            if (platformRun === "Windows") {
                testBackends.push("Windows-clDNN");
                TTFCClog("console", "will support Windows platform with clDNN backend");
                continue;
            } else {
                continue;
            }
        } else if (backendModel === "Windows-WASM") {
            if (platformRun === "Windows") {
                testBackends.push("Windows-WASM");
                TTFCClog("console", "will support Windows platform with WASM backend");
                continue;
            } else {
                continue;
            }
        } else if (backendModel === "Windows-WebGL2") {
            if (platformRun === "Windows") {
                testBackends.push("Windows-WebGL2");
                TTFCClog("console", "will support Windows platform with WebGL2 backend");
                continue;
            } else {
                continue;
            }
        } else if (backendModel === "Linux-WASM") {
            if (platformRun === "Linux") {
                testBackends.push("Linux-WASM");
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--disable-features=WebML");
                remoteURL = "https://brucedai.github.io/nt/test/index-local.html?backend=wasm";
            } else {
                continue;
            }
        } else if (backendModel === "Linux-WebGL2") {
            if (platformRun === "Linux") {
                testBackends.push("Linux-WebGL2");
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--disable-features=WebML");
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
        await driver.wait(until.elementLocated(By.xpath("//*[@id='mocha-stats']/li[1]/canvas")), 100000).then(function() {
            TTFCClog("console", "open remote URL: " + remoteURL);
        }).catch(function() {
            throw new Error("failed to load web page");
        });

        await driver.sleep(10000);

        await driver.wait(async function() {
            if (until.elementLocated(By.xpath("//*[@id='mocha-stats']/li[1]/canvas"))) {
                let pass = await driver.findElement(By.xpath("//ul[@id='mocha-stats']/li[@class='passes']//em")).getText() >> 0;
                let fail = await driver.findElement(By.xpath("//ul[@id='mocha-stats']/li[@class='failures']//em")).getText() >> 0;
                if ((pass + fail) === (baselinejson[backendModel]["total"] - baselinejson[backendModel]["block"])) {
                    return true;
                } else {
                    return false;
                }
            }
        }, 100000).then(function() {
            TTFCClog("console", "load remote URL is completed, no crash");
        }).catch(function(err) {
            if (err.message.search("session deleted because of page crash")) {
                continueFlag = true;
                crashData.push(backendModel);
                TTFCClog("console", "remote URL is crashed");
            } else {
                throw err;
            }
        });

        if (continueFlag) {
            continue;
        }

        TTFCClog("console", "checking with '" + backendModel + "' backend is start");

        TTFCClog("console", "checking....");

        await graspResult();

        pageDataTotal.get(backendModel).get("grasp").push(graspData["total"]);
        pageDataTotal.get(backendModel).get("grasp").push(graspData["pass"]);
        pageDataTotal.get(backendModel).get("grasp").push(graspData["fail"]);
        pageDataTotal.get(backendModel).get("grasp").push(graspData["block"]);
        pageDataTotal.get(backendModel).get("grasp").push(Math.round((graspData["pass"] / graspData["total"]) * 100).toString() + "%");

        await driver.sleep(2000);
        await driver.close();
        await driver.sleep(2000);

        TTFCClog("console", "checking with '" + backendModel + "' backend is completed");
    }

    for (let value of writeCSVData.values()) {
        csvStream.write(value);
    }

    await createHtmlFile();

    htmlStream.end();
    csvStream.end();

    await driver.quit();
    await driver.sleep(2000);

    driver = new Builder()
        .forBrowser("chrome")
        .setChromeOptions(new Chrome.Options())
        .build();

    await driver.get("file://" + process.cwd() + "/output/report-check-result.html");
})().then(function() {
    TTFCClog("console", "checking chromium code is completed");
}).catch(function(err) {
    TTFCClog("console", err);
});
