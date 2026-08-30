const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ALL_KINDS_LABEL,
  ALL_YEARS_LABEL,
  kindLocked,
  kindSegments,
  lockedTitle,
  yearSegments
} = require('../src/components/home/segments.ts');

const ALL_KINDS = ['riksdag', 'region', 'kommun'];
const NO_AREA = { valtyp: '', lan: '', kommun: '' };

function labels (segments) {
  return segments.map(segment => segment.label);
}

function locked (segments) {
  return segments.filter(segment => segment.disabled).map(segment => segment.value);
}

test('"alla" is the first segment, never locked, and carries the empty value', () => {
  for (const filters of [NO_AREA, { valtyp: 'kommun', lan: '01', kommun: '0114' }]) {
    const [first] = kindSegments(ALL_KINDS, filters);
    assert.equal(first.value, '');
    assert.equal(first.label, ALL_KINDS_LABEL);
    assert.equal(first.disabled, undefined);
    assert.equal(first.title, undefined);
  }

  const [firstYear] = yearSegments(['2022']);
  assert.equal(firstYear.value, '');
  assert.equal(firstYear.label, ALL_YEARS_LABEL);
  assert.equal(firstYear.disabled, undefined);
});

test('nothing is locked until an area is chosen', () => {
  assert.deepEqual(locked(kindSegments(ALL_KINDS, NO_AREA)), []);
  assert.equal(kindLocked('riksdag', { lan: '', kommun: '' }), false);
});

test('a county locks the parliamentary election alone', () => {
  assert.deepEqual(locked(kindSegments(ALL_KINDS, { valtyp: '', lan: '01', kommun: '' })), ['riksdag']);
  assert.equal(kindLocked('riksdag', { lan: '01', kommun: '' }), true);
  assert.equal(kindLocked('region', { lan: '01', kommun: '' }), false);
  assert.equal(kindLocked('kommun', { lan: '01', kommun: '' }), false);
});

test('a municipality locks the parliamentary and the regional election', () => {
  assert.deepEqual(
    locked(kindSegments(ALL_KINDS, { valtyp: '', lan: '01', kommun: '0114' })),
    ['riksdag', 'region']
  );
  assert.equal(kindLocked('kommun', { lan: '01', kommun: '0114' }), false);
});

test('the lock text sits on the locked segments and names the election type', () => {
  const segments = kindSegments(ALL_KINDS, { valtyp: '', lan: '', kommun: '0114' });
  const titled = segments.filter(segment => segment.title);
  assert.deepEqual(titled.map(segment => segment.value), ['riksdag', 'region']);
  assert.equal(titled[0].title, lockedTitle('riksdag'));
  assert.match(titled[0].title, /^Riksdagsval gäller inte ett valt område/);
  assert.match(titled[1].title, /^Regionval gäller inte ett valt område/);
  assert.equal(segments.find(segment => segment.value === 'kommun').title, undefined);
});

test('the list follows the data, not the three types', () => {
  assert.deepEqual(labels(kindSegments(['riksdag'], NO_AREA)), [ALL_KINDS_LABEL, 'Riksdagsval']);
  assert.deepEqual(labels(kindSegments([], NO_AREA)), [ALL_KINDS_LABEL]);
});

test('the chosen type always has a segment, in canonical position', () => {
  assert.deepEqual(
    labels(kindSegments(['riksdag'], { valtyp: 'region', lan: '', kommun: '' })),
    [ALL_KINDS_LABEL, 'Riksdagsval', 'Regionval']
  );
  assert.deepEqual(
    labels(kindSegments(['kommun'], { valtyp: 'riksdag', lan: '', kommun: '' })),
    [ALL_KINDS_LABEL, 'Riksdagsval', 'Kommunval']
  );
});

test('a type the data and the filter both name appears once', () => {
  const segments = kindSegments(ALL_KINDS, { valtyp: 'region', lan: '', kommun: '' });
  assert.deepEqual(labels(segments), [ALL_KINDS_LABEL, 'Riksdagsval', 'Regionval', 'Kommunval']);
  assert.equal(new Set(segments.map(segment => segment.value)).size, segments.length);
});

test('the year segments keep the order the data gives them', () => {
  assert.deepEqual(yearSegments(['2018', '2022', '2026']), [
    { value: '', label: ALL_YEARS_LABEL },
    { value: '2018', label: '2018' },
    { value: '2022', label: '2022' },
    { value: '2026', label: '2026' }
  ]);
  assert.deepEqual(yearSegments([]), [{ value: '', label: ALL_YEARS_LABEL }]);
});
