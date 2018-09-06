const Builder = require("../node_modules/selenium-webdriver").Builder;
const By = require("../node_modules/selenium-webdriver").By;
const until = require("../node_modules/selenium-webdriver").until;
const Chrome = require("../node_modules/selenium-webdriver/chrome");
const fs = require("fs");
const os = require("os");

var sys = os.type();
var platformRun = null;
if (sys == "Linux") {
    platformRun = "linux";
} else if (sys == "Darwin") {
    platformRun = "mac";
} else if (sys == "Windows_NT") {
    platformRun = "windows";
}

var remoteURL, driver;
var backendModels = ["MPS", "BNNS", "WASM", "WEBGL2", "NNAPI"];

var TTFCCjson = JSON.parse(fs.readFileSync("./TTFCC.config.json"));
var andriodFlag = TTFCCjson.andriod;
var chromiumPath = TTFCCjson.chromiumPath;
var chromeOption = new Chrome.Options();

var debugFlag = true;
function TTFCClog (target, message) {
    if (target == "console") {
        console.log("TTFCC -- " + message);
    } else if (target == "debug") {
        if (debugFlag) console.log("TTFECC -- " + message);
    } else {
        throw new Error("Not support target '" + target + "'");
    }
}

(async function() {
    TTFCClog("console", "checking chromium code is start");

    for (let i = 0; i < backendModels.length; i++) {
        if (backendModels[i] === "MPS") {
            remoteURL = "https://brucedai.github.io/nt/testa/index-local.html?backend=mps";

            if (platformRun === "mac") {
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--enable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModels[i] === "BNNS") {
            remoteURL = "https://brucedai.github.io/nt/testa/index-local.html?backend=bnns";

            if (platformRun === "mac") {
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--enable-features=WebML");
            } else {
                continue;
            }
        } else if (backendModels[i] === "WASM") {
            remoteURL = "https://brucedai.github.io/nt/test/index-local.html?backend=wasm";

            if (platformRun === "mac") {
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--disable-features=WebML");
            }
        } else if (backendModels[i] === "WEBGL2") {
            remoteURL = "https://brucedai.github.io/nt/test/index-local.html?backend=webgl2";

            if (platformRun === "mac") {
                chromeOption = chromeOption
                    .setChromeBinaryPath(chromiumPath)
                    .addArguments("--disable-features=WebML");
            }
        } else if (backendModels[i] === "NNAPI") {
            if (andriodFlag) {
                remoteURL = "https://brucedai.github.io/nt/testa/index-local.html";
                chromeOption = chromeOption
                    .androidPackage("org.chromium.chrome")
                    .addArguments("--enable-features=WebML");
            } else {
                continue;
            }
        }

        driver = new Builder()
            .forBrowser("chrome")
            .setChromeOptions(chromeOption)
            .build();

        await driver.get(remoteURL);
        await driver.wait(until.elementLocated(By.xpath('//*[@id="mocha-stats"]')), 100000).then(function() {
            TTFCClog("console", "open remote URL: " + remoteURL);
        }).catch(function() {
            throw new Error("failed to load web page");
        });
        await driver.sleep(10000);
        await driver.close();
    }
})().then(function() {
    TTFCClog("console", "checking chromium code is completed");
    driver.quit();
}).catch(function(err) {
    TTFCClog("console", err);
    driver.quit();
});