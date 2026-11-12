/**
 * ACCOQUEST API adapter for Cloudflare Pages Functions.
 * ADD this to the existing Code.gs. Do not remove existing game functions.
 * Configure Script Property ACCOQUEST_API_KEY with the same secret as the
 * Cloudflare Pages environment variable ACCOQUEST_API_KEY.
 * Existing doGet(e) can remain as-is; this adapter adds doPost(e).
 */
function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('ACCOQUEST_API_KEY');
    if (!expected || payload.apiKey !== expected) {
      return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Unauthorized API request.'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const data = payload.data || {};
    let result;
    switch (payload.action) {
      case 'createLobby': result = createLobby(data); break;
      case 'joinLobby': result = joinLobby(data); break;
      case 'getGameState': result = getGameState(data); break;
      case 'setReady': result = setReady(data); break;
      case 'startGame': result = startGame(data); break;
      case 'getQuestion': result = getQuestion(data); break;
      case 'submitAnswer': result = submitAnswer(data); break;
      case 'chooseBlock': result = chooseBlock(data); break;
      case 'spinPoints': result = spinPoints(data); break;
      case 'resetGame': result = resetGame(data); break;
      default: throw new Error('Unknown API action: ' + payload.action);
    }
    return ContentService.createTextOutput(JSON.stringify({ok:true,data:result}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:err.message || String(err)}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
