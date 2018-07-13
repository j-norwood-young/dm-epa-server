const puppeteer = require("puppeteer");
const restify = require("restify");
const fs = require("fs");
const path = require("path");
const { URL } = require('url');
const fse = require("fs-extra");
const request = require("request-promise-native");
const md5 = require("md5");
const corsMiddleware = require('restify-cors-middleware');
const cheerio = require("cheerio");
const Jimp = require("jimp");

require("dotenv").config();

var logged_in = false;

// Authorization
var authorization = (req, res, next) => {
	console.log(req.query);
	if (process.env.APIKEY && req.query.apikey && process.env.APIKEY === req.query.apikey) return next();
	if (!process.env.APIUSERNAME && !process.env.APIKEY) return next();
	if (!req.authorization.basic)
		return res.send(403, { status: "error", message: "Forbidden" });
	if (process.env.APIUSERNAME === req.authorization.basic.username && process.env.APIPASSWORD === req.authorization.basic.password) return next();
	res.send(403, { status: "error", message: "Forbidden" });
};

const epaLogin = async (page) => {
	console.log("Loading url", process.env.LOGIN_URL);
	try {
		await page.goto(process.env.LOGIN_URL);

		// Login
		await page.waitForSelector("input[name='LOGINNAME']");

		await page.type("input[name='LOGINNAME']", process.env.USERNAME);
		await page.type("input[name='PASSWORD']", process.env.PASSWORD);
		await page.click("form > div.controls > input.button.button-login.submit");
		await page.waitForSelector(".user_welcome_message");

		console.log("Logged in!");
	} catch(err) {
		console.error("Login failed", err);
	}
	logged_in = new Date();
	return;
}

const checkLogin = (req, res, next) => {
	if (logged_in)
		return next();
	res.send(500, {
		status: "error",
		message: "Not logged in to EPA site"
	});
}

const cors = corsMiddleware({
	origins: ['*']
});

(async () => {

	// Start server
	var server = restify.createServer();

	server.pre(cors.preflight);
	server.use(cors.actual);

	server.use(restify.plugins.bodyParser());
	server.use(restify.plugins.queryParser());
	server.use(restify.plugins.authorizationParser());

	server.use(authorization);

	server.get("/status", (req, res) => {
		res.send({
			status: "okay",
			data: {
				logged_in
			}
		})
	});

	server.use(checkLogin);

	server.get("/download", async (req, res) => {
		var processImage = async (filePath, res) => {
			try {
				var image = await Jimp.read(filePath);
			} catch(err) {
				console.trace(error);
			}
			image.scaleToFit(1920, 1920).quality(75);
			image.getBuffer(Jimp.MIME_JPEG, (err, buffer) => {
				res.set("Content-Type", Jimp.MIME_JPEG);
				res.set("Content-Disposition", `attachment; filename=${ md5(filePath) }.jpg`);
				res.send(buffer);
			});
		}
		try {
			let url = Buffer.from(req.query.url, "base64").toString("ascii");
			console.log({ url });
			try {
				let cookies = await page.cookies();
			} catch(err) {
				console.trace(error);
			}
			let jar = request.jar();
			let data = null;
			for (let cookie of cookies) {
				jar.setCookie(`${cookie.name}=${cookie.value}`, process.env.BASE_URL);
			}
			let filePath = path.resolve(`./downloads/cache/${ md5(url) }.jpg`);
			try {
				const fileExists = await fse.pathExists(filePath);
			} catch(err) {
				console.trace(error);
			}
			if (!fileExists) {
				var writeStream = fs.createWriteStream(filePath);
				writeStream.on("finish", async function() {
					console.log(filePath, "Not cached");
					processImage(filePath, res);
				})
				request({ url, jar }).pipe(writeStream);
			} else {
				console.log(filePath, "Cached");
				processImage(filePath, res);
			}
		} catch(err) {
			console.trace(err);
			return res.send({ status: "error", message: err });
		};
	});

	var search = async (req, res) => {
		var searchstr = req.query.s;
		var url = process.env.SEARCH_URL.replace("SEARCHSTR", searchstr);
		// console.log(`Navigating to ${url}`)
		// await page.goto(url);
		try {
			let cookies = await page.cookies();
		} catch(err) {
			console.trace(error);
		}
		let jar = request.jar();
		for (let cookie of cookies) {
			jar.setCookie(`${cookie.name}=${cookie.value}`, process.env.BASE_URL);
		}
		try {
			var result = await request({ url, jar });
		} catch(err) {
			console.trace(err);
			return res.send({ status: "error", message: err });
		}
		var $ = cheerio.load(result);
		let login_check = $("a[href='/login']");
		if (!login_check) {
			try {
				await epaLogin(page);
			} catch(err) {
				console.trace(error);
			}
			return search(req, res);
		}
		var data = [];
		$("div.media-item").each((i, el) => {
			let image = $(el).find("img.medium-image");
			let download = $(el).find(".downloadhighres").find("a");
			let media_item_number = $(el).find(".media-item-medianumber");
			if (image.length && download.length && media_item_number.length) {
				let headline = $(el).find(".metadata-value").text();
				let blurb = $(image).attr("alt");
				let src = process.env.BASE_URL + $(image).attr("src");
				let original_url = process.env.BASE_URL + $(download).attr("href");
				let uid = $(media_item_number).text();
				uid = uid.trim();
				// let download_url = "Placeholder";
				// console.log({ uid, blurb, src, download_url, original_url });
				let download_url = `${ process.env.LOCAL_URL }/download?url=${ Buffer.from(original_url).toString('base64') }`;
				if (process.env.APIKEY) download_url += `&apikey=${ process.env.APIKEY }`;
				data.push({ uid, headline, blurb, src, download_url, original_url });
			}
		});
		res.send({
			status: "okay",
			data
		});
	}

	server.get("/search", search);

	server.get("/test", async (req, res) => {
		let html = fs.readFileSync("test.html");
		let $ = cheerio.load(html);
		var data = [];
		$("div.media-item").each((i, el) => {
			let image = $(el).find("img.medium-image");
			let download = $(el).find(".downloadhighres").find("a");
			let media_item_number = $(el).find(".media-item-medianumber");
			if (image.length && download.length && media_item_number.length) {
				let headline = $(el).find(".metadata-value").text();
				let blurb = $(image).attr("alt");
				let src = $(image).attr("src");
				let original_url = $(download).attr("href");
				let uid = $(media_item_number).text();
				uid = uid.trim();
				// let download_url = "Placeholder";
				// console.log({ uid, blurb, src, download_url, original_url });
				let download_url = `${ server.url }/download?url=${ Buffer.from(original_url).toString('base64') }`;
				data.push({ uid, headline, blurb, src, download_url, original_url });
			}
		});
		res.send({
			status: "okay",
			data
		});
	});

	server.listen(process.env.PORT, function() {
		console.log('%s listening at %s', server.name, server.url);
	});

	try {
		const headless = (process.env.ENVIRONMENT === "production");
		const browser = await puppeteer.launch({ headless, timeout: 5000 });
		const page = await browser.newPage();
	} catch(err) {
		console.trace(error);
	}

	page.on("request", async request => {
		try {
			var url = await request.url();
		} catch(err) {
			console.trace(error);
		}
		if (['image', 'stylesheet', 'font', 'script'].indexOf(request.resourceType()) !== -1) {
			// console.log("Skipping", url);
			request.abort();
		} else {
			console.log("Downloading", url);
			request.continue();
		}
	});

	// Download all images
	page.on('response', async (response) => {
		const matches = /.*\.(jpg|png|svg|gif)$/.exec(response.url());
		if (matches && (matches.length === 2)) {
			const url = new URL(response.url());
			let filePath = path.resolve(`./downloads${url.pathname}`);
			// console.log(filePath);
			try {
				await fse.outputFile(filePath, await response.buffer());
			} catch(err) {
				console.trace(err);
			}
		}
	});

	try {
		await page.setRequestInterception(true);
		await epaLogin(page);
	} catch(err) {
		console.trace(error);
	}

	const refresh_mins = process.env.REFRESH_MINS || 10;

	setInterval(async function() {
		try {
			await epaLogin(page);
		} catch(err) {
			console.trace(err);
		}
	}, refresh_mins * 60000);

	// browser.close();
})();
