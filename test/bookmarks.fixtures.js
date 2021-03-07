function makeBookmarksArray() {
	return [
		{
			id: 1,
			title: 'Test Bookmark 1',
			url: 'http://www.testbookmark1.com',
			rating: 5,
			description: 'test bookmark 1 desc',
		},
		{
			id: 2,
			title: 'Test Bookmark 2',
			url: 'http://www.testbookmark2.com',
			rating: 5,
			description: 'test bookmark 2 desc',
		},
		{
			id: 3,
			title: 'Test Bookmark 3',
			url: 'http://www.testbookmark3.com',
			rating: 5,
			description: 'test bookmark 3 desc',
		},
		{
			id: 4,
			title: 'Test Bookmark 4',
			url: 'http://www.testbookmark4.com',
			rating: 5,
			description: 'test bookmark 4 desc',
		},
	];
}

module.exports = {
	makeBookmarksArray,
};
