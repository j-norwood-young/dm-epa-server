const puppeteer = require("puppeteer");
const restify = require("restify");
const fs = require("fs");
const path = require("path");
const { URL } = require('url');
const fse = require("fs-extra");
const request_promise = require("request-promise-native");
const request = require("request");
const md5 = require("md5");
const corsMiddleware = require('restify-cors-middleware');
const cheerio = require("cheerio");
const gm = require("gm").subClass({ imageMagick: true });

require("dotenv").config();

var logged_in = false;

// Authorization
var authorization = (req, res, next) => {
	// console.log(req.query);
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
		if (await page.$(".user_welcome_message") !== null) return;
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

const download = function (uri, filename) {
	return new Promise((resolve, reject) => {
		request.head(uri, function (err, res, body) {
			console.log('content-type:', res.headers['content-type']);
			console.log('content-length:', res.headers['content-length']);

			request(uri).pipe(fs.createWriteStream(filename)).on('close', resolve).on("error", reject);
		});
	});
};

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
		const processImage = async (filePath, res) => {
			console.time("processImage");
			try {
				gm(filePath)
					.resize(1920, 1920, "^")
					.quality(75)
					.toBuffer("JPEG", (err, buffer) => {
						res.set("Content-Type", "image/jpeg");
						res.set("Content-Disposition", `attachment; filename=${md5(filePath)}.jpg`);
						try {
							res.send(buffer);
						} catch(err) {
							console.error(err);
							res.send(500, { error: err });
						}
						console.timeEnd("processImage");
					});
			} catch(err) {
				console.timeEnd("processImage");
				console.error(err);
				throw(err);
			}
		}

		try {
			const url = Buffer.from(req.query.url, "base64").toString("ascii");
			const filePath = path.resolve(`./downloads/cache/${md5(url)}.jpg`);
			console.log({ url, filePath });
			try {
				var cookies = await page.cookies();
			} catch(err) {
				console.error(err);
			}
			let jar = request_promise.jar();
			let data = null;
			for (let cookie of cookies) {
				jar.setCookie(`${cookie.name}=${cookie.value}`, process.env.BASE_URL);
			}
			let fileExists = false;
			try {
				let stats = await fse.stat(filePath);
				fileExists = !!(stats.size);
			} catch(err) {
				// console.error(err);
			}
			if (!fileExists) {
				// let current = 0;
				// var writeStream = fs.createWriteStream(filePath);
				// console.time(`File download: ${filePath}`);
				// writeStream.on("end", async function() {
				// 	console.log(filePath, "Not cached");
				// 	console.timeEnd(`File download: ${filePath}`);
				// 	processImage(filePath, res);
				// })
				// writeStream.on("data", chunk => {
				// 	current += chunk.length;
				// 	console.log({ current });
				// })
				// writeStream.on("error", err => {
				// 	console.error(err);
				// 	console.timeEnd(`File download: ${filePath}`);
				// 	fse.unlink(filePath);
				// })
				try {
					console.time(`File download: ${filePath}`);
					await download({ url, jar }, filePath);
					// const fileData = await request_promise({ url, jar });
					// await fse.writeFile(filePath, fileData);
					console.timeEnd(`File download: ${filePath}`);
					processImage(filePath, res);
				} catch(err) {
					console.error(err);
					res.send(500, { error: err });
				}
			} else {
				console.log(filePath, "Cached");
				processImage(filePath, res);
			}
		} catch(err) {
			console.error(err);
			return res.send({ status: "error", message: err });
		};
	});

	const search = async (req, res) => {
		var searchstr = req.query.s;
		console.log({ searchstr });
		console.time(`Search: ${searchstr}`);
		var url = process.env.SEARCH_URL.replace("SEARCHSTR", searchstr);
		try {
			var cookies = await page.cookies();
		} catch(err) {
			console.error(err);
		}
		let jar = request_promise.jar();
		for (let cookie of cookies) {
			jar.setCookie(`${cookie.name}=${cookie.value}`, process.env.BASE_URL);
		}
		try {
			var result = await request_promise({ url, jar });
		} catch(err) {
			console.error(err);
			return res.send({ status: "error", message: err });
		}
		var $ = cheerio.load(result);
		let login_check = $("a[href='/login']");
		if (!login_check) {
			try {
				await epaLogin(page);
			} catch (err) {
				console.error(err);
				res.send(500, { error: err });
				console.timeEnd(`Search: ${searchstr}`);
				return;
			}
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
		console.timeEnd(`Search: ${searchstr}`);
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
		var headless = (process.env.ENVIRONMENT === "production");
		console.log("Loading Pupeteer, headless", headless);
		var browser = await puppeteer.launch({ headless, timeout: 5000 });
		var page = await browser.newPage();
	} catch(err) {
		console.error(error);
	}

	page.on("request", async req => {
		try {
			var url = await req.url();
		} catch(err) {
			console.error(error);
		}
		if (['image', 'stylesheet', 'font', 'script'].indexOf(req.resourceType()) !== -1) {
			// console.log("Skipping", url);
			req.abort();
		} else {
			console.log("Downloading", url);
			req.continue();
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
				console.error(err);
			}
		}
	});

	try {
		await page.setRequestInterception(true);
		await epaLogin(page);
	} catch(err) {
		console.error(error);
	}

	const refresh_mins = process.env.REFRESH_MINS || 30;

	setInterval(async function() {
		try {
			await epaLogin(page);
		} catch(err) {
			console.error(err);
		}
	}, refresh_mins * 60000);

	// browser.close();
})();
