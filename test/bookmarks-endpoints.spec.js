const { expect } = require('chai');
const express = require('express');
const knex = require('knex');
const app = require('../src/app');
const supertest = require('supertest');
const BookmarksService = require('../src/bookmarks-service');
const { makeBookmarksArray } = require('./bookmarks.fixtures');

describe('Bookmarks Endpoint', () => {
	let db;
	before('make knex instance', () => {
		db = knex({
			client: 'pg',
			connection: process.env.TEST_DB_URL,
		});
		app.set('db', db);
	});

	after('disconnect from db', () => db.destroy());

	before('clean the table', () => db('bookmarks').truncate());

	afterEach('cleanup', () => db('bookmarks').truncate());

	describe('GET /articles', () => {
		context('Given no bookmarks', () => {
			it('response with 200 and an empty list', () => {
				return supertest(app)
					.get('/bookmarks')
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.expect(200, []);
			});
		});

		context('Given there are bookmarks in the db', () => {
			const testBookmarks = makeBookmarksArray();

			beforeEach('insert bookmarks', () => {
				return db.into('bookmarks').insert(testBookmarks);
			});

			it('GET /bookmarks responds with 200 and all bookmarks', () => {
				return supertest(app)
					.get('/bookmarks')
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.expect(200, testBookmarks);
			});
		});
	});

	describe('GET /bookmarks/:bookmark_id', () => {
		context('Given no bookmarks', () => {
			it('Responds with 404', () => {
				const bookmarkId = 12345;
				return supertest(app)
					.get(`/bookmarks/${bookmarkId}`)
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.expect(404, { error: { message: `Bookmark doesn't exist.` } });
			});
		});

		context('Given there are bookmarks in db', () => {
			const testBookmarks = makeBookmarksArray();
			beforeEach('insert bookmarks', () => {
				return db.into('bookmarks').insert(testBookmarks);
			});

			it('responds with 200 and the specified bookmark', () => {
				const bookmarkId = 2;
				const expectedBookmark = testBookmarks[bookmarkId - 1];
				return supertest(app)
					.get(`/bookmarks/${bookmarkId}`)
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.expect(200, expectedBookmark);
			});
		});
	});
});
