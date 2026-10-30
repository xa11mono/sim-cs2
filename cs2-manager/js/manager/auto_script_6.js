
/* ================================================================
 * v27.8b — Bomb recovery + role switches + stable traffic controller
 * This layer sits above the existing v27.8 simulation without replacing
 * the economy/combat core. Roles can be disabled per player from the editor.
 * ================================================================ */
(function(){
  'use strict';

  const V278 = {
    version:'27.8b',
    roleKey:'cs2_mirage_roles_v2',
    traffic:{
      safeGap:17.8,
      emergencyGap:15.2,
      maxCorrection:3.2,
      cooldownMs:140
    }
  };

  R.v278 = R.v278 || {roleBrain:true, roleConfigLoaded:false, lastTrafficFix:0};

  function v278RoleEnabled(p){
    if(!p || p.roleEnabled===false || R.v278.roleBrain===false) return false;
    const team=v278TeamObj(p.team);
    return team?.aiRoleBrainEnabled!==false;
  }
  function v278Role(p){ return String(p?.role||'Support'); }
  function v278RoleScore(p){
    const r=v278Role(p);
    const base={IGL:100,Support:92,Lurker:82,AWPer:68,'Entry-fragger':18,Rifler:74};
    let s=base[r]||70;
    s += Math.min(12,Math.max(0,(Number(p?.hp)||100)-70)*0.10);
    if(p?.roleEnabled===false) s -= 14;
    return s;
  }
  function v278TeamObj(team){ return team==='CT'?CT_TEAM:T_TEAM; }

  function v278DefaultRoleConfig(teamObj){
    if(!teamObj) return;
    if(teamObj.aiRoleBrainEnabled===undefined) teamObj.aiRoleBrainEnabled=true;
    (teamObj.players||[]).forEach((p,i)=>{
      if(!p.role) p.role = (typeof ROLE_POOL!=='undefined' ? ROLE_POOL[i%ROLE_POOL.length] : 'Support');
      if(p.roleEnabled===undefined) p.roleEnabled=true;
    });
  }

  function v278ApplyRoleConfigToLive(){
    const map=new Map();
    [T_TEAM,CT_TEAM].forEach(t=>{
      v278DefaultRoleConfig(t);
      (t.players||[]).forEach(p=>map.set(`${t===T_TEAM?'T':'CT'}:${p.nick}`,p));
    });
    R.v278.roleBrain = T_TEAM.aiRoleBrainEnabled!==false || CT_TEAM.aiRoleBrainEnabled!==false;
    (R.players||[]).forEach(p=>{
      const d=map.get(`${p.team}:${p.nick}`);
      if(d){ p.role=d.role||p.role; p.roleEnabled=d.roleEnabled!==false; }
      p.v278RoleDisabled=!v278RoleEnabled(p);
      p.v28RoleLabel = p.role;
    });
  }

  function v278LoadRoleConfig(){
    v278DefaultRoleConfig(T_TEAM); v278DefaultRoleConfig(CT_TEAM);
    try{
      const raw=localStorage.getItem(V278.roleKey);
      if(raw){
        const cfg=JSON.parse(raw);
        const apply=(teamObj,data)=>{
          if(!teamObj||!data) return;
          if(typeof data.aiRoleBrainEnabled==='boolean') teamObj.aiRoleBrainEnabled=data.aiRoleBrainEnabled;
          const byNick=new Map((data.players||[]).map(x=>[x.nick,x]));
          (teamObj.players||[]).forEach((p)=>{
            const d=byNick.get(p.nick); if(!d) return;
            if(typeof d.role==='string') p.role=d.role;
            if(typeof d.roleEnabled==='boolean') p.roleEnabled=d.roleEnabled;
          });
        };
        apply(T_TEAM,cfg.T); apply(CT_TEAM,cfg.CT);
      }
    }catch(e){ console.warn('[CS2 Radar v27.8] role config load failed',e); }
    R.v278.roleConfigLoaded=true;
  }

  function v278SaveRoleConfig(){
    [T_TEAM,CT_TEAM].forEach(v278DefaultRoleConfig);
    const clean=t=>({
      aiRoleBrainEnabled:t.aiRoleBrainEnabled!==false,
      players:(t.players||[]).map(p=>({nick:p.nick,role:p.role,roleEnabled:p.roleEnabled!==false}))
    });
    try{ localStorage.setItem(V278.roleKey,JSON.stringify({version:2,T:clean(T_TEAM),CT:clean(CT_TEAM)})); }catch(e){}
    v278ApplyRoleConfigToLive();
    if(typeof autoSave==='function') autoSave();
    v278UpdateRolePanel();
  }

  v278LoadRoleConfig();

  // Live role changes are reflected immediately; weapon type follows AWPer.
  function v278ApplyRolesLive(){
    v278ApplyRoleConfigToLive();
    (R.players||[]).forEach(p=>{
      if(typeof WPN==='undefined') return;
      if(v278Role(p)==='AWPer' && p.weapon!=='awp'){p.weapon='awp';p.wd=WPN.awp;}
      if(v278Role(p)!=='AWPer' && p.weapon==='awp'){p.weapon=p.team==='T'?'ak':'m4';p.wd=WPN[p.weapon];}
    });
  }

  function v278SetRole(team,nick,role,on){
    const t=v278TeamObj(team); if(!t?.players) return;
    const p=t.players.find(x=>x.nick===nick); if(!p) return;
    if(typeof role==='string' && typeof ROLE_POOL!=='undefined' && ROLE_POOL.includes(role)) p.role=role;
    if(typeof on==='boolean') p.roleEnabled=on;
    v278SaveRoleConfig();
    v278ApplyRolesLive();
    if(R.active && typeof refreshPlayerObjectives==='function') refreshPlayerObjectives(true);
  }

  // ---------- Role editor UI ----------
  function roleSelectHtml(p){
    const opts=(typeof ROLE_POOL!=='undefined'?ROLE_POOL:['IGL','AWPer','Entry-fragger','Support','Lurker']);
    return opts.map(r=>`<option value="${r}" ${p.role===r?'selected':''}>${(typeof ROLE_LABELS!=='undefined'&&ROLE_LABELS[r])?ROLE_LABELS[r]:r}</option>`).join('');
  }
  function teamRows(teamKey,teamObj){
    v278DefaultRoleConfig(teamObj);
    return (teamObj.players||[]).map(p=>`
      <div style="display:grid;grid-template-columns:24px minmax(90px,1fr) 155px 54px;gap:6px;align-items:center;padding:5px 6px;border-top:1px solid #1e2734;">
        <input type="checkbox" data-v278-role-on="1" data-team="${teamKey}" data-nick="${String(p.nick).replace(/"/g,'&quot;')}" ${p.roleEnabled!==false?'checked':''} title="Включить role brain">
        <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-weight:800;font-size:10px;">${p.nick}</div>
        <select data-v278-role="1" data-team="${teamKey}" data-nick="${String(p.nick).replace(/"/g,'&quot;')}" style="padding:4px 5px;font-size:10px;">${roleSelectHtml(p)}</select>
        <span style="font-size:8px;color:${p.roleEnabled!==false?'#58c58a':'#ef5364'};text-align:right;">${p.roleEnabled!==false?'AI ON':'OFF'}</span>
      </div>`).join('');
  }

  function ensureRolePanel(){
    const toolbar=document.getElementById('cs2-rf-edit-toolbar'); if(!toolbar) return null;
    let panel=document.getElementById('cs2-rf-role-panel');
    if(panel) return panel;
    const btnRow=toolbar.querySelector('div');
    if(btnRow && !document.getElementById('cs2-rf-roles-btn')){
      const b=document.createElement('button');
      b.id='cs2-rf-roles-btn';b.className='cs2-rf-btn';b.textContent='👥 Роли AI';
      b.style.cssText='background:#1a2230;border:1px solid #ff9f43;color:#ff9f43;padding:5px 12px;border-radius:5px;cursor:pointer;font-size:11px;font-weight:800;';
      b.onclick=()=>{
        const rp=document.getElementById('cs2-rf-role-panel');
        if(rp) rp.style.display=rp.style.display==='none'?'block':'none';
        if(rp && rp.style.display!=='none') v278UpdateRolePanel();
      };
      btnRow.insertBefore(b,btnRow.children[1]||null);
    }
    panel=document.createElement('div');
    panel.id='cs2-rf-role-panel';
    panel.style.cssText='display:none;background:#0b1017;border:1px solid #ff9f43;border-radius:7px;margin-top:2px;padding:7px 8px;';
    toolbar.appendChild(panel);
    panel.addEventListener('change',e=>{
      const t=e.target;
      if(t.matches('[data-v278-master]')){
        const team=v278TeamObj(t.dataset.team); if(team){team.aiRoleBrainEnabled=t.checked;v278SaveRoleConfig();v278ApplyRolesLive();}
        return;
      }
      if(t.matches('[data-v278-role-on]')){
        v278SetRole(t.dataset.team,t.dataset.nick,null,t.checked);if(typeof v2715Sync==='function')v2715Sync(true);return;
      }
      if(t.matches('[data-v278-role]')){
        v278SetRole(t.dataset.team,t.dataset.nick,t.value,undefined);if(typeof v2715Sync==='function')v2715Sync(true);return;
      }
    });
    return panel;
  }

  function v278UpdateRolePanel(){
    const panel=document.getElementById('cs2-rf-role-panel'); if(!panel) return;
    v278DefaultRoleConfig(T_TEAM);v278DefaultRoleConfig(CT_TEAM);
    const liveCarrier=(R.bomb?.state==='carried'&&R.bomb.carrier)?R.bomb.carrier.nick:'—';
    panel.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
        <div style="color:#ff9f43;font-weight:900;font-size:11px;">👥 ROLE BRAIN • Mirage</div>
        <div style="font-size:9px;color:#7d8b9f;">C4 сейчас: <b style="color:#ef5364;">${liveCarrier}</b></div>
      </div>
      <div style="font-size:9px;color:#9aa7b8;line-height:1.35;margin-bottom:7px;">Галочка включает/выключает ролевой AI для конкретного игрока. Обычно C4 получает IGL/Support/Lurker/AWPer; <b style="color:#ff9f43;">Entry имеет низкий приоритет</b>. При выбитой C4 ближайший живой T автоматически получает задачу RECOVER.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;">
        ${['T','CT'].map(teamKey=>{
          const team=v278TeamObj(teamKey);return `<div style="border:1px solid #263244;border-radius:6px;background:#0e141c;overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:5px;padding:6px 7px;background:#121a24;border-bottom:1px solid #263244;">
              <span style="font-weight:900;color:${teamKey==='T'?'#f0b429':'#4f9cf7'};">${teamKey==='T'?'T':'CT'} • ${team.name}</span>
              <label style="font-size:8px;color:#aab6c6;display:flex;align-items:center;gap:4px;"><input type="checkbox" data-v278-master="1" data-team="${teamKey}" ${team.aiRoleBrainEnabled!==false?'checked':''}> role brain</label>
            </div>
            <div>${teamRows(teamKey,team)}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;">
        <button type="button" id="cs2-rf-role-save" class="cs2-rf-btn" style="background:#1a2230;border:1px solid #58c58a;color:#58c58a;padding:4px 10px;border-radius:5px;font-size:10px;font-weight:800;cursor:pointer;">💾 Сохранить роли</button>
        <button type="button" id="cs2-rf-role-reset" class="cs2-rf-btn" style="background:#1a2230;border:1px solid #ef5364;color:#ef5364;padding:4px 10px;border-radius:5px;font-size:10px;font-weight:800;cursor:pointer;">↩ Сбросить роли</button>
      </div>`;
    panel.querySelector('#cs2-rf-role-save')?.addEventListener('click',()=>{v278SaveRoleConfig();});
    panel.querySelector('#cs2-rf-role-reset')?.addEventListener('click',()=>{
      [T_TEAM,CT_TEAM].forEach(t=>{
        t.aiRoleBrainEnabled=true;
        (t.players||[]).forEach((p,i)=>{p.roleEnabled=true;p.role=(typeof ROLE_POOL!=='undefined'?ROLE_POOL[i%ROLE_POOL.length]:'Support');});
      });
      v278SaveRoleConfig();v278ApplyRolesLive();
    });
  }

  // Expose a small debug/status API and allow editor to open the panel.
  window.__cs2RoleEditor = {
    open(){
      const p=ensureRolePanel(); if(p){p.style.display='block';v278UpdateRolePanel();}
    },
    refresh:v278UpdateRolePanel,
    save:v278SaveRoleConfig,
    setRole:v278SetRole
  };

  window.CS2AI=window.CS2AI||{};
  window.CS2AI.applyRolesLive=v278ApplyRolesLive;
  window.CS2AI.applyRoleConfig=v278ApplyRoleConfigToLive;
  window.CS2AI.trafficTick=function(){
    try{
      if(!R.active || performance.now()-(R.v278.lastTrafficFix||0)<V278.traffic.cooldownMs) return;
      R.v278.lastTrafficFix=performance.now();
      const ps=(R.players||[]).filter(p=>p.alive);
      for(let i=0;i<ps.length;i++) for(let j=i+1;j<ps.length;j++){
        const a=ps[i],b=ps[j];
        if(a.team!==b.team || Math.abs((Number(a.z)||0)-(Number(b.z)||0))>0.8) continue;
        const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy)||0.001;
        if(d>=V278.traffic.emergencyGap) continue;
        const need=V278.traffic.emergencyGap-d,ax=dx/d,ay=dy/d;
        const an=a.path&&a.pi<a.path.length-1&&WP[a.path[a.pi+1]]?Math.hypot(a.x-WP[a.path[a.pi+1]].x,a.y-WP[a.path[a.pi+1]].y):999;
        const bn=b.path&&b.pi<b.path.length-1&&WP[b.path[b.pi+1]]?Math.hypot(b.x-WP[b.path[b.pi+1]].x,b.y-WP[b.path[b.pi+1]].y):999;
        const move=an>=bn?a:b, sx=move===a?ax:-ax,sy=move===a?ay:-ay, amount=Math.min(V278.traffic.maxCorrection,need*0.72);
        const nx=move.x+sx*amount,ny=move.y+sy*amount;
        if(pointBlockedForMovement(nx,ny,move.z)) continue;
        move.x=nx;move.y=ny;move.lastX=nx;move.lastY=ny;
      }
    }catch(e){console.warn('[CS2 Radar v27.8b] traffic',e);}
  };

  // Refresh once a user switches from Test to Editor.
  document.addEventListener('click',e=>{
    if(e.target?.id==='cs2-rf-tab-edit') setTimeout(()=>{try{ensureRolePanel();}catch(_){ }},50);
  },true);

  console.log('[CS2 Radar v27.8] bomb recovery + non-entry C4 preference + role editor + stable traffic active');
})();
