const $=id=>document.getElementById(id);
let playerId=localStorage.getItem('aq_player_id')||('P'+Math.random().toString(36).slice(2)+Date.now().toString(36));
let playerName=localStorage.getItem('aq_player_name')||'';
let lobbyId=localStorage.getItem('aq_lobby_id')||'';
const forceHome=new URLSearchParams(location.search).get('home')==='1';
if(forceHome){localStorage.removeItem('aq_lobby_id');lobbyId='';history.replaceState(null,'','/');}
let state=null,activeQuestion=null,selectedAnswer=null,pollTimer=null,countdown=null,seconds=30,spinBusy=false;
let questionLoading=false;
let urlQuestionId=new URLSearchParams(location.search).get('qid');
let urlQuestionLoaded=false;
localStorage.setItem('aq_player_id',playerId);
$('username').value=playerName;
$('usernameHome').value=playerName;
const pages=['home','lobby','game','result'];
function show(id){pages.forEach(x=>$(x).classList.toggle('hidden',x!==id));$('menuHomeBtn').classList.toggle('hidden',id==='home');}
function renderLobbySkeleton(){ $('lobbyCode').classList.add('skeleton');$('lobbyCode').textContent='------';$('playerCount').classList.add('skeleton');$('playersList').innerHTML='<div class="skeleton-card"></div><div class="skeleton-card"></div>'; }
function clearLobbySkeleton(){ $('lobbyCode').classList.remove('skeleton');$('playerCount').classList.remove('skeleton');}
function renderQuestionSkeleton(){ $('scanArea').classList.add('hidden');$('questionBox').classList.remove('hidden');$('qId').textContent='';$('qCategory').textContent='';$('qText').classList.add('skeleton-question');$('qText').textContent=' ';$('answers').innerHTML='<div class="skeleton-answer"></div><div class="skeleton-answer"></div><div class="skeleton-answer"></div><div class="skeleton-answer"></div>';$('submitAnswer').disabled=true;}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),3500);}
async function gas(name,data){
 const response=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:name,data})});
 const payload=await response.json();
 if(!response.ok || payload.ok===false) throw new Error(payload.error||('API error '+response.status));
 return Object.prototype.hasOwnProperty.call(payload,'data')?payload.data:payload;
}
async function act(name,data){try{return await gas(name,data);}catch(e){toast(e.message);throw e;}}
function nameInput(){const homeVisible=!$('home').classList.contains('hidden');const field=homeVisible?$('usernameHome'):$('username');const n=field.value.trim();if(n.length<2){toast('Username minimum 2 aksara.');field.focus();return false;}playerName=n;$('username').value=n;$('usernameHome').value=n;localStorage.setItem('aq_player_name',n);return true;}
function startPolling(){clearInterval(pollTimer);poll();pollTimer=setInterval(poll,1800);}
async function poll(){if(!lobbyId)return;try{state=await gas('getGameState',{lobbyId,playerId});renderState();
 if(urlQuestionId && !urlQuestionLoaded && state.game?.isMyTurn && state.game.phase==='question'){urlQuestionLoaded=true;loadQuestion(urlQuestionId).catch(()=>{urlQuestionLoaded=false;});}}catch(e){toast(e.message);clearInterval(pollTimer);}}
function renderState(){
 if(!state)return;
 if(state.status==='waiting'){show('lobby');renderLobby();}
 else if(state.status==='playing'){show('game');renderGame();}
 else if(state.status==='finished'){show('result');renderFinal();}
}
function renderLobby(){
 clearLobbySkeleton();$('lobbyCode').textContent=state.lobbyId;$('playerCount').textContent=state.players.length+'/4';
 $('playersList').innerHTML=state.players.map(p=>`<div class="player-card"><div><div class="player-name">${esc(p.name)} ${p.host?'(HOST)':''}</div><div class="player-sub">${p.ready?'Ready to play':'Waiting for ready'}</div></div><span class="${p.ready?'ready-tag':'wait-tag'}">${p.ready?'● READY':'○ NOT READY'}</span></div>`).join('');
 const all=state.players.length>=2&&state.players.length<=4&&state.players.every(p=>p.ready);
 $('readyBtn').disabled=!state.me;$('readyBtn').textContent=state.me&&state.me.ready?'NOT READY':'READY';
 $('startBtn').classList.toggle('hidden',state.hostId!==playerId);$('startBtn').disabled=state.hostId!==playerId||!all;
 $('lobbyHint').textContent=state.players.length<2?'Menunggu sekurang-kurangnya 2 pemain.':all?'Semua pemain bersedia. Host boleh mula.':'Pastikan semua pemain menekan READY.';
}
function renderGame(){
 const g=state.game;if(!g)return;
 $('roundLabel').textContent=`ROUND ${g.round} / ${g.totalRounds}`;$('turnPlayer').textContent=g.currentPlayerName||'—';
 $('scanState').textContent=g.phase.toUpperCase();
 const mine=g.isMyTurn;
 $('scanBtn').disabled=!mine||g.phase!=='question';$('manualBtn').disabled=!mine||g.phase!=='question';
 $('blockPanel').classList.toggle('hidden',!mine||g.phase!=='block');
 $('spinPanel').classList.toggle('hidden',!mine||g.phase!=='spin');
 renderLeaderboard();
 if(mine&&g.phase==='question'){$('scanArea').classList.remove('hidden');$('questionBox').classList.add('hidden');}
 else if(!mine||g.phase!=='question'){$('scanArea').classList.add('hidden');}
 if(mine&&g.phase==='block')renderBlocks();
 if(g.lastResult&&g.lastResult.playerId===playerId&&g.phase!=='question'){
  $('answerFeedback').textContent=g.lastResult.correct?'BETUL! Jawapan tepat.':'SALAH. Jawapan tidak tepat.';
  $('answerFeedback').className='feedback '+(g.lastResult.correct?'correct':'wrong');$('answerFeedback').classList.remove('hidden');
 }
}
function renderLeaderboard(){
 const rows=state.game.scores||[];
 $('leaderboardRows').innerHTML=rows.map((p,i)=>`<div class="rank-row"><div class="rank-no">#${i+1}</div><div><div class="rank-name">${esc(p.name)}</div><div class="rank-stats">✓ ${p.correct} &nbsp; ✕ ${p.wrong}</div></div><div class="rank-score">${p.points}</div></div>`).join('');
}
function renderBlocks(){
 const used=state.game.usedBlocks||[];
 $('blocks').innerHTML=['A','B','C','D','E','F'].map(x=>`<button class="block" ${used.includes(x)?'disabled':''} data-block="${x}">${x}</button>`).join('');
 document.querySelectorAll('.block:not(:disabled)').forEach(b=>b.onclick=async()=>{await act('chooseBlock',{lobbyId,playerId,block:b.dataset.block});poll();});
}
function renderFinal(){
 const rows=(state.game?.scores||[]);$('winnerBanner').innerHTML=`CHAMPION<strong>${esc(rows[0]?.name||'—')}</strong><span>${rows[0]?.points||0} POINTS</span>`;
 $('finalRows').innerHTML=rows.slice(0,3).map((p,i)=>`<div class="final-row"><strong>${['🥇','🥈','🥉'][i]} ${esc(p.name)}</strong><span>${p.points} pts</span></div>`).join('');
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
$('createBtn').onclick=async()=>{if(!nameInput())return;const btn=$('createBtn');btn.disabled=true;btn.textContent='CREATING LOBBY...';show('lobby');renderLobbySkeleton();try{state=await act('createLobby',{playerId,name:playerName});lobbyId=state.lobbyId;localStorage.setItem('aq_lobby_id',lobbyId);renderState();startPolling();}catch(e){show('home');}finally{btn.disabled=false;btn.textContent='CREATE LOBBY';}};
$('joinBtn').onclick=async()=>{if(!nameInput())return;const code=$('joinCode').value.trim();if(!/^\d{6}$/.test(code))return toast('Masukkan kod tepat 6 digit.');const btn=$('joinBtn');btn.disabled=true;btn.textContent='JOINING...';show('lobby');renderLobbySkeleton();try{state=await act('joinLobby',{lobbyId:code,playerId,name:playerName});lobbyId=code;localStorage.setItem('aq_lobby_id',lobbyId);renderState();startPolling();}catch(e){show('home');}finally{btn.disabled=false;btn.textContent='JOIN';}};
$('saveName').onclick=()=>{if(nameInput())toast('Username disimpan.');};
$('copyCode').onclick=()=>navigator.clipboard?.writeText(lobbyId).then(()=>toast('Kod lobby disalin.'));
$('readyBtn').onclick=async()=>{const me=state.players.find(p=>p.playerId===playerId);state=await act('setReady',{lobbyId,playerId,ready:!me.ready});renderLobby();};
$('startBtn').onclick=async()=>{const r=Number(prompt('Jumlah pusingan (1–20):','3')||3);if(!Number.isInteger(r)||r<1||r>20)return toast('Pusingan mesti 1 hingga 20.');state=await act('startGame',{lobbyId,playerId,totalRounds:r});renderState();};
$('manualBtn').onclick=()=>loadQuestion($('questionId').value.trim());
$('scanBtn').onclick=scanNfc;
async function scanNfc(){
 if(!('NDEFReader' in window)){toast('Web NFC tidak disokong pada browser/peranti ini. Gunakan kad NFC URL atau masukkan ID manual.');return;}
 try{
  const reader=new NDEFReader();
  await reader.scan();
  toast('NFC aktif. Sentuhkan kad pada telefon.');
  reader.onreading=event=>{
   for(const record of event.message.records){
    if(record.recordType==='text'){
     const bytes=new Uint8Array(record.data);const langLength=bytes[0]&0x3f;const enc=(bytes[0]&0x80)?'utf-16':'utf-8';
     const id=new TextDecoder(enc).decode(bytes.slice(1+langLength)).trim();if(id)loadQuestion(id);return;
    }
    if(record.recordType==='url'){
     const bytes=new Uint8Array(record.data);const prefix=['','http://www.','https://www.','http://','https://'][bytes[0]]||'';
     const url=prefix+new TextDecoder().decode(bytes.slice(1));
     try{const id=new URL(url).searchParams.get('qid');if(id){loadQuestion(id);return;}}catch(e){}
    }
   }
  };
 }catch(e){toast('NFC gagal dimulakan: '+e.message);}
}

async function loadQuestion(id){
 if(!id)return toast('Masukkan Question ID.');renderQuestionSkeleton();let q;try{q=await act('getQuestion',{lobbyId,playerId,questionId:id});}catch(e){$('questionBox').classList.add('hidden');$('scanArea').classList.remove('hidden');return;}activeQuestion=q;selectedAnswer=null;
 $('qText').classList.remove('skeleton-question');$('qId').textContent=q.id;$('qCategory').textContent=q.category;$('qText').textContent=q.text;
 $('answers').innerHTML=q.options.map((v,i)=>`<button class="answer-option" data-answer="${'ABCD'[i]}"><b>${'ABCD'[i]}.</b> ${esc(v)}</button>`).join('');
 document.querySelectorAll('.answer-option').forEach(b=>b.onclick=()=>{selectedAnswer=b.dataset.answer;document.querySelectorAll('.answer-option').forEach(x=>x.classList.toggle('selected',x===b));$('submitAnswer').disabled=false;});
 $('answerFeedback').classList.add('hidden');$('submitAnswer').disabled=true;$('scanArea').classList.add('hidden');$('questionBox').classList.remove('hidden');
 seconds=30;$('timer').textContent='30s';clearInterval(countdown);countdown=setInterval(()=>{seconds--;$('timer').textContent=seconds+'s';if(seconds<=0){clearInterval(countdown);submit('TIMEOUT');}},1000);
}
async function submit(answer){clearInterval(countdown);$('submitAnswer').disabled=true;const res=await act('submitAnswer',{lobbyId,playerId,questionId:activeQuestion.id,answer});$('answerFeedback').textContent=res.correct?'BETUL! Jawapan tepat.':'SALAH. Jawapan tidak tepat.';$('answerFeedback').className='feedback '+(res.correct?'correct':'wrong');$('answerFeedback').classList.remove('hidden');poll();}
$('submitAnswer').onclick=()=>{if(!selectedAnswer)return toast('Pilih jawapan dahulu.');submit(selectedAnswer);};
$('spinBtn').onclick=async()=>{
 if(spinBusy)return;spinBusy=true;$('spinBtn').disabled=true;
 try{const res=await act('spinPoints',{lobbyId,playerId});const deg=1440+Math.floor(Math.random()*720);$('wheel').style.transform=`rotate(${deg}deg)`;setTimeout(()=>{$('spinResult').textContent=(res.points>0?'+':'')+res.points+' POINTS';$('spinResult').classList.remove('hidden');spinBusy=false;poll();},4100);}
 catch(e){spinBusy=false;$('spinBtn').disabled=false;}
};
$('playAgain').onclick=async()=>{state=await act('resetGame',{lobbyId,playerId});renderState();startPolling();};
$('backLobby').onclick=()=>{renderState();startPolling();};
if(lobbyId){show('lobby');renderLobbySkeleton();gas('getGameState',{lobbyId,playerId}).then(s=>{state=s;renderState();startPolling();}).catch(()=>{localStorage.removeItem('aq_lobby_id');lobbyId='';clearLobbySkeleton();show('home');});}

// Return to the initial menu: clear the remembered lobby and force a fresh page load.
$('menuHomeBtn').addEventListener('click',event=>{event.preventDefault();clearInterval(pollTimer);clearInterval(countdown);localStorage.removeItem('aq_lobby_id');lobbyId='';window.location.href='/?home=1&refresh='+Date.now();});
