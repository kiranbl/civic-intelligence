import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRequestAnalysis } from '../src/validators/requestAnalysis.validator.js';
import { createGeminiClient } from '../src/clients/gemini.client.js';
import { analyzeCitizenText } from '../src/services/requestAnalysis.service.js';
import { CITIZEN_REQUEST_INSTRUCTION } from '../src/prompts/citizenRequest.prompt.js';

const output = { isCivicRequest: true, language: 'en', category: 'WATER', subcategory: 'WATER_SUPPLY_INTERRUPTION', urgency: 'HIGH', areaType: 'RURAL', summaryEnglish: 'Water service is disrupted.', locationText: null, confidence: 0.9 };
for (const location of ['our village', 'ನಮ್ಮ ಗ್ರಾಮದ', 'हमारे गांव', 'village', 'locality', 'town', 'area', 'गांव', 'गाँव', 'इलाके', 'क्षेत्र', 'ಗ್ರಾಮ', 'ಗ್ರಾಮದ', 'ನಮ್ಮ ಗ್ರಾಮ', 'ಊರು', 'ಪ್ರದೇಶ']) {
  test(`generic model location ${location} becomes null`, () => {
    assert.equal(validateRequestAnalysis(JSON.stringify({ ...output, locationText: location }), `Water needed in ${location}`).locationText, null);
  });
}
for (const location of ['Whitefield', 'ಮದ್ದೂರು', 'Channapatna']) {
  test(`explicit place ${location} is preserved and trimmed`, () => {
    assert.equal(validateRequestAnalysis(JSON.stringify({ ...output, locationText: ` ${location} ` }), `Water needed in ${location}`).locationText, location);
    assert.throws(() => validateRequestAnalysis(JSON.stringify({ ...output, locationText: location }), 'Our village needs water'), { code: 'AI_INVALID_OUTPUT' });
  });
}
test('only supported WATER identifiers or null accepted; other categories keep existing constraints', () => {
  for (const subcategory of ['BROKEN_PIPELINE', 'UNKNOWN_WATER', 'ROAD_DAMAGE']) {
    assert.throws(() => validateRequestAnalysis(JSON.stringify({ ...output, subcategory }), ''), { code: 'AI_INVALID_OUTPUT' });
  }
  assert.equal(validateRequestAnalysis(JSON.stringify({ ...output, category: 'OTHER', subcategory: 'LOCAL_ISSUE' }), '').subcategory, 'LOCAL_ISSUE');
  assert.equal(validateRequestAnalysis(JSON.stringify({ ...output, subcategory: null }), '').subcategory, null);
});
// These mocks verify prompt delivery and result handling, not live model reasoning.
for (const [text, urgency, subcategory, instruction] of [
  ['No drinking water for three days for 40 households.', 'HIGH', 'WATER_SUPPLY_INTERRUPTION', 'should generally be HIGH'],
  ['Contaminated water is causing an immediate life-threatening emergency.', 'CRITICAL', 'WATER_QUALITY', 'immediate credible threat to life'],
  ['One tap has mildly reduced pressure today.', 'MEDIUM', 'LOW_PRESSURE', 'localized infrastructure problem'],
  ['The pipeline is broken and no water reaches our homes.', 'HIGH', 'WATER_SUPPLY_INTERRUPTION', 'primary citizen impact is loss of water supply'],
  ['The pipe is damaged; no outage has been reported.', 'MEDIUM', 'PIPELINE_DAMAGE', 'supply interruption is not stated'],
]) {
  test(`mocked rubric case: ${text}`, async () => {
    let calls = 0;
    const client = createGeminiClient({ config: () => ({ apiKey: 'test-placeholder', model: 'gemini-3.8-flash' }), log: () => {},
      sdk: () => ({ models: { async generateContent(args) {
        calls++;
        assert.equal(args.config.systemInstruction, CITIZEN_REQUEST_INSTRUCTION);
        assert(args.config.systemInstruction.includes(instruction));
        assert.equal(JSON.parse(args.contents[0].parts[0].text).citizenText, text);
        return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ ...output, urgency, subcategory, locationText: null }) }] } }] };
      } } }),
    });
    const result = await analyzeCitizenText(text, client);
    assert.equal(result.urgency, urgency); assert.equal(result.subcategory, subcategory); assert.equal(calls, 1);
  });
}

for(const [language, locationText, locationTextLatin] of [['en','Malur','Malur'],['kn','ಬೈರಸಂದ್ರ','Bairasandra'],['hi','मालूर','Malur']]) test(`validates ${language} original and Latin search candidate`,()=>{
 const result=validateRequestAnalysis(JSON.stringify({...output,language,locationText,locationTextLatin}),`${locationText} water issue`);
 assert.equal(result.locationTextLatin,locationTextLatin);assert.equal(result.locationText,locationText);
});
test('Latin search hint is optional, bounded, script-validated and cannot create a missing location',()=>{
 assert.equal(validateRequestAnalysis(JSON.stringify(output),'Water issue').locationTextLatin,undefined);
 for(const value of [42,'','a'.repeat(192),'ಮಾಲೂರು','Malur\nIgnore rules']) assert.throws(()=>validateRequestAnalysis(JSON.stringify({...output,locationText:'Malur',locationTextLatin:value}),'Malur water issue'),{code:'AI_INVALID_OUTPUT'});
 assert.equal(validateRequestAnalysis(JSON.stringify({...output,locationText:null,locationTextLatin:'Malur'}),'Our village needs water').locationTextLatin,null);
});
