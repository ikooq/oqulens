import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../src/lib/csv';
import { analyze } from '../src/lib/analytics';
import { generateDemo } from '../src/lib/generator';
import { analyzeDynamics, verdict } from '../src/lib/dynamics';

test('identical local student and class IDs remain separate across schools', () => {
 const input='school,class_id,student_id,textbook,section,score,max_score\nA,7A,1,B,T,2,10\nB,7A,1,B,T,9,10';
 const a=analyze(parseCsv(input,'test').dataset!.rows)!;
 assert.equal(a.meta.nStudents,2); assert.equal(a.meta.nClasses,2); assert.equal(a.meta.nSchools,2); assert.equal(a.overall.mean,55);
});
test('hours without estimable effect stay unchanged', () => {
 const ds=generateDemo(2026); const rows=ds.rows.map(r=>({...r,actualHours:r.sectionOrder===1?r.plannedHours:r.actualHours}));
 const a=analyze(rows)!; assert.equal(a.hours.sections[0].delta,0);
});
test('dynamics works without variation in baseline', () => {
 const ds=generateDemo(2026); const d=analyzeDynamics(ds.rows.map(r=>({...r,baselinePct:50})))!;
 assert.ok(Number.isFinite(d.overall.change.est));
});
test('incompatible observed effect is not called confirmed', () => {
 const ds=generateDemo(2026); const d=analyzeDynamics(ds.rows)!;
 const section={...d.sections[0], slope:{est:100,se:1,lo:98,hi:102,significant:true}};
 assert.notEqual(verdict(section,2),'confirmed');
});
test('missing hours do not yield NaN predictions', () => {
 const ds=generateDemo(2026);
 const a=analyze(ds.rows.map(r=>({...r,plannedHours:0,actualHours:0})))!;
 assert.equal(a.hours.ok,false);
 assert.ok(Number.isFinite(a.hours.meanBefore));
 assert.ok(Number.isFinite(a.forecast(a.hours.sections.map(s=>s.planned)).lowShare));
});
test('missing locality and language are preserved as unknown', () => {
 const input='school,class_id,student_id,textbook,section,score,max_score\nA,7A,1,B,T,2,10';
 const result=parseCsv(input,'test');
 assert.equal(result.dataset!.rows[0].locality,'неизвестно');
 assert.equal(result.dataset!.rows[0].language,'неизвестно');
 assert.ok(result.dataset!.quality!.checks.some(c=>c.level==='warn' && c.text.includes('Неизвестная местность')));
});
test('partial missing baselines disable baseline adjustment for dynamics', () => {
 const ds=generateDemo(2026); ds.rows[0].baselineMissing=true;
 const d=analyzeDynamics(ds.rows)!;
 assert.equal(d.hasBaseline,false);
 assert.ok(Number.isFinite(d.overall.change.est));
});
test('schools with the same name in different districts are separated', () => {
 const input='district,school,class_id,student_id,textbook,section,score,max_score\nD1,School 1,7A,1,B,T,2,10\nD2,School 1,7A,1,B,T,9,10';
 const a=analyze(parseCsv(input,'test').dataset!.rows)!;
 assert.equal(a.meta.nSchools,2); assert.equal(a.meta.nStudents,2); assert.equal(a.overall.mean,55);
});
