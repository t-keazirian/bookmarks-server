const express = require('express');
const logger = require('../logger');
const { isWebUri } = require('valid-url');
const xss = require('xss');
const path = require('path');

const bookmarkRouter = express.Router();
const bodyParser = express.json();
const BookmarksService = require('../bookmarks-service');

bookmarkRouter
	.route('/')
	.get((req, res, next) => {
		const knexInstance = req.app.get('db');
		BookmarksService.getAllBookmarks(knexInstance)
			.then(bookmarks => {
				res.json(bookmarks);
			})
			.catch(next);
	})
	.post(bodyParser, (req, res, next) => {
		const { title, url, rating, description } = req.body;
		const newBookmark = {
			title,
			url,
			rating,
			description,
		};

		if (!title) {
			logger.error('Title is required');
			return res.status(400).send('Title is required');
		}

		if (!url) {
			logger.error('URL is required');
			return res.status(400).send('URL is required');
		}

		if (!rating) {
			logger.error('Rating is required');
			return res.status(400).send('Rating is required');
		}

		if (!description) {
			logger.error('Description is required');
			return res.status(400).send('Description is required');
		}

		if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
			logger.error(`Invalid rating: ${rating}`);
			return res.status(400).send('Rating must be a number between 0 and 5.');
		}

		if (!isWebUri(url)) {
			logger.error(`Invalid url: ${url}`);
			return res.status(400).send('url must be a valid URL');
		}

		const knexInstance = req.app.get('db');
		BookmarksService.insertBookmark(knexInstance, newBookmark)
			.then(bookmark => {
				res
					.status(201)
					.location(path.posix.join(req.originalUrl, `${bookmark.id}`))
					.json(bookmark);
			})
			.catch(next);
	});

bookmarkRouter
	.route('/:bookmark_id')
	.all((req, res, next) => {
		BookmarksService.getBookmarkById(req.app.get('db'), req.params.bookmark_id)
		.then(bookmark => {
			if (!bookmark) {
				return res.status(404).json({
					error: {message: `Bookmark doesn't exist`}
				})
			}
			res.bookmark = bookmark;
			next()
		})
		.catch(next)
	})
	.get((req, res, next) => {
		const knexInstance = req.app.get('db');
		BookmarksService.getBookmarkById(knexInstance, req.params.bookmark_id)
			.then(bookmark => {
				if (!bookmark) {
					return res
						.status(404)
						.json({ error: { message: `Bookmark doesn't exist.` } });
				}
				res.json({
					id: bookmark.id,
					title: xss(bookmark.title),
					url: bookmark.url,
					rating: bookmark.rating,
					description: xss(bookmark.description),
				});
			})
			.catch(next);
	})

	.delete((req, res, next) => {
		const knexInstance = req.app.get('db');
		BookmarksService.deleteBookmark(knexInstance, req.params.bookmark_id)
			.then(() => {
				res.status(204).end();
			})
			.catch(next);
	})

	.patch(bodyParser, (req, res, next) => {
		const {title, url, description, rating} = req.body;
		const bookmarkToUpdate = {title, url, description, rating};

		const numberOfValues = Object.values(bookmarkToUpdate).filter(Boolean).length;
		if (numberOfValues === 0) {
			return res.status(400).json({
				error: {
					message: `Request body must contain either 'title', 'rating', or 'url'`
				}
			})
		}

		const knexInstance = req.app.get('db');
		BookmarksService.updateBookmark(
			knexInstance, req.params.bookmark_id, bookmarkToUpdate
		)
		.then(() => {
			res.status(204).end()
		})
		.catch(next)
	})

module.exports = bookmarkRouter;


