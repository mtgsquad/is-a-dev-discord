const express = require("express");
const multer = require("multer");
const fetch = require("node-fetch");
const { WebhookClient } = require("discord.js");
const { Octokit } = require("@octokit/rest");
const User = require("../models/user.js");
const Prdata = require("../models/prdata.js");
const prdata = require("../models/prdata.js");
const { ListDomains } = require("./web/listDomains.js");
const { CheckDomain } = require("./web/CheckDomain.js");
const { CountDomains } = require("./web/Count.js");
const { DomainInfo } = require("./web/DomainInfo.js");
const { WebFork } = require("./web/fork.js");
const { RegisterDomain } = require("./web/Register.js");
require("dotenv").config();
const controller = require("../models/control.js");

const GITHUB_ID = process.env.GITHUB_ID;
const GITHUB_SECRET = process.env.GITHUB_SECRET;

const upload = multer();
const server = express();
server.set("view engine", "ejs");

server.get("/auth/handler", async (req, res) => {
    const code = req.query.code;
    const discordId = req.query.discordId;

    const response = await fetch(`https://github.com/login/oauth/access_token?client_id=${GITHUB_ID}&client_secret=${GITHUB_SECRET}&code=${code}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
    });

    const data = await response.json();

    const accessToken = data.access_token;

    // get user info
    const userResponse = await fetch("https://api.github.com/user", {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
    });

    const userData = await userResponse.json();
    const username = userData.login;

    // get user email
    const emailResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
    });

    const emailData = await emailResponse.json();
    const email = emailData[0].email;

    if (await User.findOne({ userid: discordId })) {
        await User.replaceOne({ userid: discordId }, { gittoken: accessToken });

        res.send("You are already logged in!");
        return;
    }

    await User.create({
        userid: discordId,
        githubid: username,
        email: email,
        gittoken: accessToken,
    });

    res.render("logged-in", { username });
});

server.get("/guides/forwarder", (req, res) => {
    // get query params from url and store in variables
    const email = req.query.email;
    const subdomain = req.query.domain;
    res.render("email-forwarder", { email, subdomain });
});

server.get("/guides/replit", (req, res) => {
    // get query param
    const replurl = req.query.repl;
    const subdomain = req.query.domain;
    res.render("replit", { replurl, subdomain })
})

server.get("/api/domains", async (req, res) => {
    const domain = req.query.domain;
    const username = req.query.username;
    if (!domain && !username) {
        res.send("No domain or username provided.");
        return;
    }
    if (domain) {
        const domains = await DomainInfo(domain);
        res.send(domains);
        return;
    }
    if (username) {
        const domains = await ListDomains(username);
        res.send(domains);
        return;
    }
    const domains = await ListDomains(username);
    res.send(domains);
});

server.get("/api/check-domain", async (req, res) => {
    const domain = req.query.domain;
    const result = await CheckDomain(domain);
    res.send(result);
});

server.get("/api/count-domains", async (req, res) => {
    const result = await CountDomains();
    res.send(result);
});


server.post ('/api/email', upload.none(), (req, res) => {
    const body = req.body;
  
    console.log(`From: ${body.from}`);
    console.log(`To: ${body.to}`);
    console.log(`Subject: ${body.subject}`);
    console.log(`Text: ${body.text}`);
    const text = body.from;
    const emailRegex = /<([^>]+)>/;
    const match = text.match(emailRegex);
    let emailAddress;

    if (match && match[1]) {
         emailAddress = match[1];
        console.log(emailAddress);
    } else {
        console.log("No email address found.");
    }
    // send to discord webhook
    const webhookClient = new WebhookClient({ url: process.env.webhook });
    const embed = {
      "type": "rich",
      "title": `Email from: ${body.from}`,
      "description": `Subject: ${body.subject}`,
      "color": 0x00FFFF,
      "fields": [
        {
          "name": `Message`,
          "value": `${body.text}`
        },
        {
            "name": `Reply command`,
            "value": `/send-email ${emailAddress}`
        }
      ]
    }
  
    webhookClient.send({
      username: 'Is-a.dev',
      avatarURL: 'https://raw.githubusercontent.com/is-a-dev/register/main/media/logo.png',
      embeds: [embed],
    });
  
  
  
    return res.status(200).send();
});

server.get("/api/fork", async (req, res) => {
    //const DisableFork = await controller.findOne({ name: "DisableFork" });
    //if (DisableFork.status === "true") {
   //     res.status(500).json({ "ERROR": "This endpoint is currently disabled." });
   //     return;
    //}
    const apikey = req.query.apikey;
    if (!apikey) {
        res.json({ Error: 'No Apikey provided' })
        return;
    }
    const result = await WebFork(apikey);
    res.send(result);
});

server.post("/api/register", upload.none(), async (req, res) => {
    //if (DisableRegister.status === "true") {
    //    res.status(500).json({ "ERROR": "This endpoint is currently disabled." });
    //    return;
    //}
    const body = req.body.content;
    const username = body.username;
    const apikey = body.apikey;
    const email = body.email;
    const subdomain = body.subdomain;
    if (!username || !apikey || !subdomain) {
        res.send("No username, apikey, or subdomain provided.");
        return;
    }
    res.status(500).send({"ERROR": "This endpoint is currently disabled."});
    return;
    const jsonData = JSON.parse(body);
    const content = jsonData.CONTENT;
    const type = jsonData.TYPE;

    const result = await RegisterDomain(subdomain, type, username, email, apikey, content);
    // if result json contains ERROR, send error
    if (result.ERROR) {
        res.status(500).send(result);
        return;
    }
    else {
        res.status(202).res.send(result);
        return;
    }
    //send response and status code
    //
    //res.send("body: " + JSON.stringify(body) + "\nusername: " + username + "\napikey: " + apikey + "\nemail: " + email + "\nsubdomain: " + subdomain);
});

// Notify API
server.get("/pr/merged/:pr", async function (req, res) {
    var pr = req.params.pr;

    const BOT_TOKEN = process.env.BOT_TOKEN;

    const octokit = new Octokit({
        auth: BOT_TOKEN,
    });

    const PRDATA = await Prdata.findOne({ prid: pr });

    if (!PRDATA) {
        await fetch("https://raw.githubusercontent.com/is-a-dev/team-docs/main/pr-merged.md")
            .then((response) => response.text())
            .then((data) => {
                // Do something with your data
                console.log(data);
                octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
                    owner: "is-a-dev",
                    repo: "register",
                    issue_number: pr,
                    body: data,
                });
            });

        await prdata.create({
            prid: pr,
            merged: true,
        });

        res.send("PR Not Found, Created PR Data");
    } else {
        res.send("PR Found, Checking Status");
    }
});

server.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

function keepAlive() {
    server.listen(3000, () => {
        console.log("Server is ready.");
    });
}

module.exports = keepAlive;
