(() => {
  'use strict';
  const KEY='frida-paris-stages-v1';
  const columns=['consider','shortlist','booked'];
  const labels={consider:'À regarder',shortlist:'Shortlist',booked:'Inscrite'};
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const stages=[...(window.__STAGES__||[])];
  let state=readState();
  let query='',category='',draggedId=null;
  const grip='<svg viewBox="0 0 24 24"><circle cx="8" cy="7" r="1.2"/><circle cx="16" cy="7" r="1.2"/><circle cx="8" cy="12" r="1.2"/><circle cx="16" cy="12" r="1.2"/><circle cx="8" cy="17" r="1.2"/><circle cx="16" cy="17" r="1.2"/></svg>';

  function readState(){
    try{
      const value=JSON.parse(localStorage.getItem(KEY));
      return value&&value.statuses?value:{statuses:{},order:{}};
    }catch{return {statuses:{},order:{}}}
  }
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(state))}
    catch{toast('Le navigateur bloque la sauvegarde locale')}
  }
  function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function statusOf(stage){return state.statuses[stage.id]||'consider'}
  function matches(stage){
    const hay=[stage.title,stage.provider,stage.category,stage.location,stage.price,stage.why,stage.watch].join(' ').toLowerCase();
    return (!query||hay.includes(query))&&(!category||stage.category===category);
  }
  function ordered(items,column){
    const saved=state.order[column]||[];
    const map=new Map(saved.map((id,i)=>[id,i]));
    return [...items].sort((a,b)=>{
      const ai=map.has(a.id)?map.get(a.id):9999;
      const bi=map.has(b.id)?map.get(b.id):9999;
      return ai-bi||b.fit-a.fit||a.title.localeCompare(b.title,'fr');
    });
  }
  function badge(stage){
    if(stage.status==='alternative-courte')return '<span class="stage-badge short">Alternative courte</span>';
    if(stage.status==='a-contacter')return '<span class="stage-badge warn">À contacter</span>';
    if(stage.status==='a-surveiller')return '<span class="stage-badge warn">À surveiller</span>';
    return '<span class="stage-badge good">Programme à vérifier</span>';
  }
  function fitDots(score){return `<span class="fit" title="Compatibilité ${score}/5">${[1,2,3,4,5].map(n=>`<span class="${n<=score?'on':''}"></span>`).join('')}</span>`}
  function card(stage){
    const status=statusOf(stage);
    return `<article class="stage-card" draggable="true" data-id="${esc(stage.id)}">
      <div class="stage-card-top"><span class="stage-provider">${esc(stage.provider)}</span>${fitDots(stage.fit)}<button class="stage-handle" type="button" aria-label="Déplacer ${esc(stage.title)}">${grip}</button></div>
      <div class="stage-badges"><span class="stage-badge">${esc(stage.category)}</span>${badge(stage)}</div>
      <h3>${esc(stage.title)}</h3>
      <p class="why">${esc(stage.why)}</p>
      <div class="stage-meta">
        <div class="stage-meta-row"><strong>Prix</strong><span>${esc(stage.price||'À confirmer')}</span></div>
        <div class="stage-meta-row"><strong>Lieu</strong><span>${esc(stage.location)}</span></div>
        <div class="stage-meta-row"><strong>Âge</strong><span>${esc(stage.age)}</span></div>
        <div class="stage-meta-row"><strong>Format</strong><span>${esc(stage.format)}</span></div>
        <div class="stage-meta-row"><strong>Période</strong><span>${esc(stage.timing)}</span></div>
      </div>
      <div class="stage-watch"><strong>À vérifier :</strong> ${esc(stage.watch)}</div>
      <div class="stage-actions">
        <a class="stage-link" href="${esc(stage.url)}" target="_blank" rel="noopener">Voir le site</a>
        <select class="stage-select" aria-label="Changer le statut">${columns.map(k=>`<option value="${k}"${k===status?' selected':''}>${labels[k]}</option>`).join('')}</select>
      </div>
    </article>`;
  }
  function render(){
    const groups={consider:[],shortlist:[],booked:[]};
    stages.filter(matches).forEach(s=>groups[statusOf(s)].push(s));
    columns.forEach(key=>groups[key]=ordered(groups[key],key));
    $$('.stage-column').forEach(col=>{
      const key=col.dataset.column,list=groups[key],box=$('.stage-cards',col);
      $('.count',col).textContent=list.length;
      box.innerHTML=list.length?list.map(card).join(''):`<div class="stage-empty">${query||category?'Aucun résultat.':'Glisse un stage ici.'}</div>`;
    });
    bindCards();
    fillCategories();
  }
  function fillCategories(){
    const select=$('#stageCategory');
    const categories=[...new Set(stages.map(s=>s.category))].sort((a,b)=>a.localeCompare(b,'fr'));
    const current=select.value||category;
    select.innerHTML='<option value="">Toutes les catégories</option>'+categories.map(c=>`<option${c===current?' selected':''}>${esc(c)}</option>`).join('');
  }
  function bindCards(){
    $$('.stage-card').forEach(cardEl=>{
      cardEl.addEventListener('dragstart',e=>{
        if(e.target.closest('a,button,select')){e.preventDefault();return}
        draggedId=cardEl.dataset.id;cardEl.classList.add('dragging');e.dataTransfer.setData('text/plain',draggedId);e.dataTransfer.effectAllowed='move';
      });
      cardEl.addEventListener('dragend',cleanup);
      $('.stage-select',cardEl).addEventListener('change',e=>move(cardEl.dataset.id,e.target.value));
      $('.stage-handle',cardEl).addEventListener('pointerdown',e=>beginTouch(e,cardEl));
    });
  }
  function cleanup(){
    draggedId=null;
    $$('.stage-card').forEach(c=>c.classList.remove('dragging'));
    $$('.stage-column').forEach(c=>c.classList.remove('drag-over'));
  }
  function dropBefore(column,y,movingId){
    const cards=$$('.stage-card',$('.stage-cards',column)).filter(c=>c.dataset.id!==movingId);
    for(const c of cards){const r=c.getBoundingClientRect();if(y<r.top+r.height/2)return c.dataset.id}
    return null;
  }
  $$('.stage-column').forEach(col=>{
    col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over')});
    col.addEventListener('dragleave',e=>{if(!col.contains(e.relatedTarget))col.classList.remove('drag-over')});
    col.addEventListener('drop',e=>{
      e.preventDefault();
      const id=draggedId||e.dataTransfer.getData('text/plain');
      const before=dropBefore(col,e.clientY,id);
      if(id)move(id,col.dataset.column,before);
      cleanup();
    });
  });
  function beginTouch(event,cardEl){
    if(event.pointerType==='mouse')return;
    event.preventDefault();
    const id=cardEl.dataset.id,handle=event.currentTarget,rect=cardEl.getBoundingClientRect();
    const startX=event.clientX,startY=event.clientY,offsetX=startX-rect.left,offsetY=startY-rect.top;
    let active=false,ghost=null,targetColumn=null;
    try{handle.setPointerCapture(event.pointerId)}catch{}
    const start=()=>{
      active=true;draggedId=id;cardEl.classList.add('dragging');ghost=cardEl.cloneNode(true);ghost.classList.add('stage-ghost');ghost.removeAttribute('draggable');ghost.style.width=Math.min(rect.width,330)+'px';document.body.appendChild(ghost);
    };
    const timer=setTimeout(start,100);
    const movePointer=e=>{
      if(e.pointerId!==event.pointerId)return;
      if(!active&&Math.hypot(e.clientX-startX,e.clientY-startY)>7){clearTimeout(timer);start()}
      if(!active)return;
      e.preventDefault();
      ghost.style.left=Math.min(window.innerWidth-ghost.offsetWidth-8,Math.max(8,e.clientX-offsetX))+'px';
      ghost.style.top=Math.min(window.innerHeight-ghost.offsetHeight-8,Math.max(8,e.clientY-offsetY))+'px';
      const target=document.elementFromPoint(e.clientX,e.clientY);const col=target?.closest('.stage-column')||null;
      if(col!==targetColumn){$$('.stage-column').forEach(c=>c.classList.remove('drag-over'));targetColumn=col;targetColumn?.classList.add('drag-over')}
      const board=$('#stageBoard'),br=board.getBoundingClientRect();if(e.clientX>br.right-45)board.scrollLeft+=18;if(e.clientX<br.left+45)board.scrollLeft-=18;
    };
    const finish=e=>{
      clearTimeout(timer);handle.removeEventListener('pointermove',movePointer);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);
      if(!active)return;
      const target=document.elementFromPoint(e.clientX,e.clientY);const col=target?.closest('.stage-column')||targetColumn;const before=col?dropBefore(col,e.clientY,id):null;
      ghost?.remove();cardEl.classList.remove('dragging');$$('.stage-column').forEach(c=>c.classList.remove('drag-over'));draggedId=null;
      if(col)move(id,col.dataset.column,before);
    };
    const cancel=()=>{clearTimeout(timer);handle.removeEventListener('pointermove',movePointer);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);ghost?.remove();cleanup()};
    handle.addEventListener('pointermove',movePointer,{passive:false});handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',cancel);
  }
  function move(id,column,beforeId=null){
    columns.forEach(k=>state.order[k]=(state.order[k]||[]).filter(x=>x!==id));
    state.statuses[id]=column;
    const order=state.order[column]||[];
    if(beforeId&&order.includes(beforeId))order.splice(order.indexOf(beforeId),0,id);else order.push(id);
    state.order[column]=order;save();render();toast(`Stage déplacé vers « ${labels[column]} »`);
  }
  function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}
  $('#stageSearch').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();render()});
  $('#stageCategory').addEventListener('change',e=>{category=e.target.value;render()});
  window.addEventListener('storage',e=>{if(e.key===KEY){state=readState();render()}});
  render();
})();