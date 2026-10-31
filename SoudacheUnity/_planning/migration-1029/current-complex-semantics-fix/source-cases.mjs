  const normalize=s=>Object.fromEntries(Object.entries(s||{}).filter(([k,v])=>typeof v==='number'&&v!==0).sort());
  const unit=u=>({hp:u.hp,atk:u.atk||0,dead:!!u.dead,status:normalize(u.status),armor:u.defense?.armor||0,shield:u.defense?.shield||0,guard:!!u.defense?.guard});
  const snap=f=>({player:{...unit(f.r.pstat),hp:f.r.G.hp,armor:f.r.pdef.armor,shield:f.r.pdef.shield,guard:!!f.r.pdef.guard},allies:f.r.allies.filter(a=>!a.dead).map(unit),foes:f.r.foes.map(unit),energy:f.r.energy,turn:f.r.turn});
  async function runPlay(f,uid,target=null){const result=f.engine.submitCardPlay(uid,target,true);await Promise.race([f.engine.idle(),new Promise(resolve=>setTimeout(resolve,100))]);if(result.status==='rejected')throw Error(uid+':'+JSON.stringify(result.reason));return result;}
  async function nextTurn(f){const before=f.r.turn;f.engine.endTurn();for(let n=0;n<4000&&(f.r.busy||f.r.turn===before);n++)await new Promise(r=>setTimeout(r,1));if(f.r.busy||f.r.turn===before)throw Error('unsettled turn');await f.engine.idle();}
  const rows=[];
  for(let seed=1;seed<=8;seed++)for(const scenario of ['gate-empty','gate-prefer','gate-purify','gate-other-door']){
    const f=fixture(['tt7-recruit','tt8-hero-summoner'],false,false,seed);f.r.foes[0].atk=0;f.r.set$maxEnergy(10);f.r.set$energy(10);
    await runPlay(f,'o0','self');
    if(['gate-prefer','gate-purify'].includes(scenario))for(const u of [f.r.pstat,...f.r.allies]){Object.assign(u.status,{stealth:2,atkUp:1,spellUp:1,reduce:1});if(scenario==='gate-purify'){u.defense.armor=3;u.status.poison=1;}}
    if(['gate-prefer','gate-purify'].includes(scenario))Object.assign(f.r.pdef,f.r.pstat.defense);
    await runPlay(f,'o1');f.engine.pickChoice(1);await Promise.race([f.engine.idle(),new Promise(r=>setTimeout(r,100))]);await nextTurn(f);
    const after=snap(f);let second,third;if(scenario==='gate-other-door'){await nextTurn(f);second=snap(f);await nextTurn(f);third=snap(f);}
    rows.push({name:scenario,seed,input:f.owned,after,second,third,rng:f.engine.random.snapshot()});f.engine.finish(null);
  }
  for(const scenario of ['recruit-status','recruit-poison-death','recruit-stealth-expiry']){
    const f=fixture(['tt13-mind-control'],false,true,123);f.r.set$maxEnergy(10);f.r.set$energy(10);
    const foe=f.r.foes[0];foe.hp=scenario==='recruit-poison-death'?3:40;foe.maxHp=100;foe.atk=4;foe.defense={armor:5,shield:2,guard:false};Object.assign(foe.status,{poison:2,reduce:1,spellUp:3,freeze:scenario==='recruit-stealth-expiry'?0:1,stealth:scenario==='recruit-stealth-expiry'?1:0});f.r.foes[1].atk=3;
    // A stealthed target is unreachable: apply stealth after the real card's target gate.
    if(scenario==='recruit-stealth-expiry')foe.status.stealth=0;
    await runPlay(f,'o0',0);if(scenario==='recruit-stealth-expiry')f.r.allies[0].status.stealth=1;
    const immediate=snap(f);await nextTurn(f);const after=snap(f);await nextTurn(f);
    rows.push({name:scenario,seed:123,input:f.owned,immediate,after,second:snap(f)});f.engine.finish(null);
  }
  for(let seed=1;seed<=30;seed++){
    const f=fixture(['cmtn1epgt20j'],false,false,seed);f.r.set$maxEnergy(10);f.r.set$energy(10);await runPlay(f,'o0','self');
    const index=f.r.discovering?.options.findIndex(c=>c.id==='tt12-raydragon')??-1;
    if(index<0){f.engine.finish(null);continue;}
    const chosen=f.r.discovering.options[index];f.engine.pickDiscover(index);await f.engine.idle();const entry=f.r.hand.map(uid=>f.engine.findCard(uid)).find(e=>e.card.id===chosen.id);const before=f.r.foes[0].hp;
    for(let i=0;i<1000&&f.r.busy;i++)await new Promise(resolve=>setTimeout(resolve,1));
    if(f.r.busy)throw Error('discovery did not settle '+JSON.stringify(f.r.battleState));
    f.r.set$energy(10);await runPlay(f,entry.uid,0);rows.push({name:'noInfuse-discover',seed,input:f.owned,index,chosen:chosen.id,waiver:!!entry.card._noInfuse,damage:before-f.r.foes[0].hp,infusing:!!f.r.infusing,after:snap(f)});f.engine.finish(null);break;
  }
  if(!rows.some(r=>r.name==='noInfuse-discover'))throw Error('need dragon discovery seed');
  fs.writeFileSync(path.join(taskDir,'source-results.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify({vectors:rows.length,names:rows.map(r=>r.name),last:rows.at(-1)}));
}finally{await server.close();}
