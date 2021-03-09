const { expect } = require('chai');
const knex = require('knex');
const app = require('../src/app');
const supertest = require('supertest');
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

	describe('Unauthorized requests', () => {
		const testBookmarks = makeBookmarksArray();

		beforeEach('insert bookmarks', () => {
			return db.into('bookmarks').insert(testBookmarks);
		});

		it('responds with 401 Unauthorized for GET /bookmarks', () => {
			return (
				supertest(app).get('/api/bookmarks').expect(401),
				{ error: 'Unauthorized request' }
			);
		});

		it('responds with 401 Unauthorized for POST /api/bookmarks', () => {
			return (
				supertest(app)
					.post('/api/bookmarks')
					.send({ title: 'test-title', url: 'http://www.test.com', rating: 1 })
					.expect(401),
				{ error: 'Unauthorized request' }
			);
		});

		it('responds with 401 Unauthorized for GET /api/bookmarks/:bookmark_id', () => {
			const secondBookmark = testBookmarks[1];
			return (
				supertest(app).get(`/api/bookmarks/${secondBookmark.id}`).expect(401),
				{ error: 'Unauthorized request' }
			);
		});

		it('responds with 401 Unauthorized for DELETE /api/bookmarks/:bookmark_id', () => {
			const aBookmark = testBookmarks[1];
			return (
				supertest(app).delete(`/api/bookmarks/${aBookmark.id}`).expect(401),
				{ error: 'Unauthorized request' }
			);
		});
	});

	describe('GET /api/bookmarks', () => {
		context('Given no bookmarks', () => {
			it('response with 200 and an empty list', () => {
				return supertest(app)
					.get('/api/bookmarks')
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.expect(200, []);
			});
		});

		context('Given there are bookmarks in the db', () => {
			const testBookmarks = makeBookmarksArray();

			beforeEach('insert bookmarks', () => {
				return db.into('bookmarks').insert(testBookmarks);
			});

			it('GET /api/bookmarks responds with 200 and all bookmarks', () => {
				return supertest(app)
					.get('/api/bookmarks')
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.expect(200, testBookmarks);
			});
		});
	});

	describe('GET /api/bookmarks/:bookmark_id', () => {
		context('Given no bookmarks', () => {
			it('Responds with 404', () => {
				const bookmarkId = 12345;
				return supertest(app)
					.get(`/api/bookmarks/${bookmarkId}`)
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.expect(404, { error: { message: `Bookmark doesn't exist` } });
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
					.get(`/api/bookmarks/${bookmarkId}`)
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.expect(200, expectedBookmark);
			});
		});

		context('Given an XSS attack bookmark', () => {
			const maliciousBookmark = {
				id: 911,
				title: 'Bad Title <script>alert("xss");</script>',
				url: 'http://www.badurl.com',
				rating: 5,
				description: `Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.`,
			};

			beforeEach('insert malicious bookmark', () => {
				return db.into('bookmarks').insert([maliciousBookmark]);
			});

			it('removes XSS attack content', () => {
				return supertest(app)
					.get(`/api/bookmarks/${maliciousBookmark.id}`)
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.expect(200)
					.expect(res => {
						expect(res.body.title).to.eql(
							'Bad Title &lt;script&gt;alert("xss");&lt;/script&gt;'
						);
						expect(res.body.description).to.eql(
							`Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`
						);
					});
			});
		});
	});

	describe('POST /api/bookmarks', () => {
		it(`creates an bookmark, responding with 201 and the new bookmark`, () => {
			const newBookmark = {
				title: 'Test New Bookmark Title',
				url: 'http://www.testnewbookmark.com',
				rating: 5,
				description: 'Test new bookmark description',
			};
			return supertest(app)
				.post('/api/bookmarks')
				.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
				.send(newBookmark)
				.expect(201)
				.expect(res => {
					expect(res.body.title).to.eql(newBookmark.title);
					expect(res.body.url).to.eql(newBookmark.url);
					expect(res.body.rating).to.eql(newBookmark.rating);
					expect(res.body.description).to.eql(newBookmark.description);
					expect(res.body).to.have.property('id');
					expect(res.headers.location).to.eql(`/api/bookmarks/${res.body.id}`);
				})
				.then(postRes =>
					supertest(app)
						.get(`/api/bookmarks/${postRes.body.id}`)
						.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
						.expect(postRes.body)
				);
		});

		it(`responds with 400 and an error message when 'title' is missing`, () => {
			return (
				supertest(app)
					.post('/api/bookmarks')
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.send({
						url: 'http://www.test.com',
						rating: 5,
						description: 'test description',
					})
					.expect(400),
				{
					error: { message: `Missing 'title' in request body` },
				}
			);
		});

		it(`responds with 400 and an error message when 'description' is missing`, () => {
			return (
				supertest(app)
					.post('/api/bookmarks')
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.send({
						title: 'test title',
						url: 'http://www.test.com',
						rating: 5,
					})
					.expect(400),
				{
					error: { message: `Missing 'description' in request body` },
				}
			);
		});

		it(`responds with 400 and an error message when 'url' is missing`, () => {
			return (
				supertest(app)
					.post('/api/bookmarks')
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.send({
						title: 'test title',
						description: 'test description',
						rating: 5,
					})
					.expect(400),
				{
					error: { message: `Missing 'url' in request body` },
				}
			);
		});

		it(`responds with 400 and an error message when 'rating' is missing`, () => {
			return (
				supertest(app)
					.post('/api/bookmarks')
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.send({
						title: 'test title',
						description: 'test description',
						url: 'http://www.test.com',
					})
					.expect(400),
				{
					error: { message: `Missing 'rating' in request body` },
				}
			);
		});

		it('responds with 400 when rating is not between 1-5', () => {
			const newBookmarkInvalidRating = {
				title: 'test title',
				description: 'test description',
				url: 'http://www.test.com',
				rating: 'invalid',
			};
			return (
				supertest(app)
					.post('/api/bookmarks')
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.send(newBookmarkInvalidRating)
					.expect(400),
				{
					error: { message: `Rating must be a number between 0 and 5.` },
				}
			);
		});

		it('responds with 400 if url is not valid', () => {
			const newBookmarkInvalidUrl = {
				title: 'test title',
				description: 'test description',
				url: 'www.invalidurl.com',
				rating: '5',
			};
			return (
				supertest(app)
					.post('/api/bookmarks')
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.send(newBookmarkInvalidUrl)
					.expect(400),
				{
					error: { message: `Rating must be a number between 0 and 5.` },
				}
			);
		});
	});

	describe(`DELETE /api/bookmarks/:bookmark_id`, () => {
		context('Given there are bookmarks in the db', () => {
			const testBookmarks = makeBookmarksArray();

			beforeEach('insert bookmarks', () => {
				return db.into('bookmarks').insert(testBookmarks);
			});

			it('responds with 204 and removes the bookmark', () => {
				const idToRemove = 2;
				const expectedBookmarks = testBookmarks.filter(
					bookmark => bookmark.id !== idToRemove
				);
				return supertest(app)
					.delete(`/api/bookmarks/${idToRemove}`)
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.expect(204)
					.then(res => {
						supertest(app).get('/api/bookmarks').expect(expectedBookmarks);
					});
			});
		});

		context('Given no bookmarks', () => {
			it('responds with 404', () => {
				const bookmarkId = 12345;
				return supertest(app)
					.delete(`/api/bookmarks/${bookmarkId}`)
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.expect(404, { error: { message: `Bookmark doesn't exist` } });
			});
		});
	});

	describe(`PATCH /api/bookmarks/:bookmark_id`, () => {
		context('Given no bookmarks', () => {
			it('responds with 404', () => {
				const bookmarkId = 123456;
				return supertest(app)
					.patch(`/api/bookmarks/${bookmarkId}`)
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.expect(404, { error: { message: `Bookmark doesn't exist` } });
			});
		});

		context('Given there are bookmarks in the db', () => {
			const testBookmarks = makeBookmarksArray();

			beforeEach('insert bookmarks', () => {
				return db.into('bookmarks').insert(testBookmarks);
			});

			it('responds with 204 and updates the bookmark', () => {
				const idToUpdate = 2;
				const updateBookmark = {
					title: 'updated bookmark title',
					url: 'http://www.updatedbookmark.com',
					rating: 5,
					description: 'updated bookmark description',
				};
				const expectedBookmark = {
					...testBookmarks[idToUpdate - 1],
					...updateBookmark,
				};
				return supertest(app)
					.patch(`/api/bookmarks/${idToUpdate}`)
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.send(updateBookmark)
					.expect(204)
					.then(res => {
						supertest(app)
							.get(`/api/bookmarks/${idToUpdate}`)
							.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
							.expect(expectedBookmark);
					});
			});

			it('responds with 400 when no required fields supplied', () => {
				const idToUpdate = 2;
				return supertest(app)
					.patch(`/api/bookmarks/${idToUpdate}`)
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.send({ irrelevantField: 'foo' })
					.expect(400, {
						error: {
							message: `Request body must contain either 'title', 'rating', or 'url'`,
						},
					});
			});

			it(`responds with 204 when updating only a subset of fields`, () => {
				const idToUpdate = 2;
				const updateBookmark = {
					title: 'updated article title',
				};
				const expectedBookmark = {
					...testBookmarks[idToUpdate - 1],
					...updateBookmark,
				};

				return supertest(app)
					.patch(`/api/bookmarks/${idToUpdate}`)
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.send({
						...updateBookmark,
						fieldToIgnore: 'should not be in GET response',
					})
					.expect(204)
					.then(res => {
						supertest(app)
							.get(`/api/bookmarks/${idToUpdate}`)
							.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
							.expect(expectedBookmark);
					});
			});
		});
	});
});
