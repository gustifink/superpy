  (() => {
    'use strict';
    const KEY='frida-paris-board-v2', CUSTOM_KEY='frida-paris-custom-v1', UPDATED_KEY='frida-paris-updated-v1';
    const labels={available:'Disponibles',todo:'À faire',planned:'Prévues',past:'Passées'};
    const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
    const icons={
      calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
      pin:'<svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
      user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
      arrow:'<svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg>'
    };
    let catalog=[...window.__INITIAL_ACTIVITIES__];
    let custom=readJSON(CUSTOM_KEY,[]);
    let statuses=readJSON(KEY,{});
    let query='', category='', venue='', draggedId=null;
    function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
    function save(){localStorage.setItem(KEY,JSON.stringify(statuses));localStorage.setItem(CUSTOM_KEY,JSON.stringify(custom))}
    function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
    function all(){return [...catalog,...custom]}
    function effectiveEnd(a){return a.end||a.periodEnd||(a.recurrence?a.recurrence.until+'T23:59:00+02:00':null)||a.start||a.sortDate}
    function isExpired(a){const e=effectiveEnd(a);return e?new Date(e).getTime()<Date.now():false}
    function statusOf(a){return statuses[a.id] || (isExpired(a)?'past':'available')}
    function sortTime(a){return new Date(a.start||a.sortDate||a.periodEnd||'2099-01-01').getTime()}
    function dateText(a){
      if(a.dateLabel) return a.dateLabel;
      if(!a.start) return 'Date à choisir';
      const d=new Date(a.start), end=a.end?new Date(a.end):null;
      const day=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(d);
      const cap=day.charAt(0).toUpperCase()+day.slice(1);
      const from=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}).replace(':','h');
      const to=end?end.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}).replace(':','h'):'';
      return `${cap} · ${from}${to?'–'+to:''}`;
    }
    function nextOccurrence(a){
      if(!a.recurrence) return '';
      const now=new Date(), until=new Date(a.recurrence.until+'T23:59:59+02:00');
      for(let i=0;i<370;i++){
        const d=new Date(now); d.setHours(0,0,0,0); d.setDate(d.getDate()+i);
        if(d>until) break;
        if(a.recurrence.weekdays.includes(d.getDay())){
          const [h,m]=a.recurrence.time.split(':').map(Number); d.setHours(h,m,0,0);
          if(d>now) return 'Prochaine : '+new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(d).replace(':','h');
        }
      }
      return '';
    }
    function soonLabel(a){
      const t=sortTime(a), delta=(t-Date.now())/86400000;
      if(!a.start||delta<0||delta>8) return '';
      if(delta<1) return "Demain";
      return `Dans ${Math.ceil(delta)} j`;
    }
    function matches(a){
      const hay=[a.title,a.venue,a.category,a.description,a.why,a.address,dateText(a)].join(' ').toLowerCase();
      return (!query||hay.includes(query))&&(!category||a.category===category)&&(!venue||a.venue===venue);
    }
    function cardHTML(a){
      const soon=soonLabel(a), next=nextOccurrence(a), status=statusOf(a);
      return `<article class="card${a.featured?' featured':''}" draggable="true" data-id="${esc(a.id)}" tabindex="0" aria-label="${esc(a.title)}">
        <div class="tagline"><span class="tag">${esc(a.category||'Sortie')}</span>${soon?`<span class="soon">${esc(soon)}</span>`:''}</div>
        <h3>${esc(a.title)}</h3>
        <p class="why">${esc(a.why||a.description||'')}</p>
        <div class="meta">
          <div class="meta-row">${icons.calendar}<span>${esc(dateText(a))}${next?`<br><strong>${esc(next)}</strong>`:''}${a.timeLabel?`<br>${esc(a.timeLabel)}`:''}</span></div>
          <div class="meta-row">${icons.pin}<span>${esc(a.venue)}<br><span style="color:#88867d">${esc(a.address||'Paris')}</span></span></div>
          <div class="meta-row">${icons.user}<span>${esc(a.age||'En famille')} · ${esc(a.price||'Voir billetterie')}</span></div>
        </div>
        <div class="card-foot">
          ${a.ticketUrl?`<a class="ticket" href="${esc(a.ticketUrl)}" target="_blank" rel="noopener" data-ticket>Billets ${icons.arrow}</a>`:''}
          <button class="details" type="button" data-details>Voir le détail</button>
        </div>
        <select class="status-select" data-status aria-label="Changer le statut">${Object.entries(labels).map(([k,v])=>`<option value="${k}"${k===status?' selected':''}>${v}</option>`).join('')}</select>
      </article>`;
    }
    function render(){
      const grouped={available:[],todo:[],planned:[],past:[]};
      all().filter(matches).forEach(a=>grouped[statusOf(a)].push(a));
      Object.values(grouped).forEach(arr=>arr.sort((a,b)=>sortTime(a)-sortTime(b)));
      $$('.column').forEach(col=>{
        const key=col.dataset.column, box=$('.cards',col), list=grouped[key];
        $('.count',col).textContent=list.length;
        box.innerHTML=list.length?list.map(cardHTML).join(''):`<div class="empty">${query||category||venue?'Aucun résultat avec ces filtres.':'Glisse une carte ici.'}</div>`;
      });
      bindCards(); fillFilters();
    }
    function bindCards(){
      $$('.card').forEach(card=>{
        card.addEventListener('dragstart',e=>{draggedId=card.dataset.id;card.classList.add('dragging');e.dataTransfer.effectAllowed='move'});
        card.addEventListener('dragend',()=>{draggedId=null;card.classList.remove('dragging');$$('.column').forEach(c=>c.classList.remove('drag-over'))});
        $('[data-details]',card).addEventListener('click',()=>openDetail(card.dataset.id));
        $('[data-status]',card).addEventListener('change',e=>move(card.dataset.id,e.target.value));
        card.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.target.closest('a,button,select'))openDetail(card.dataset.id)});
      });
    }
    $$('.column').forEach(col=>{
      col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over');e.dataTransfer.dropEffect='move'});
      col.addEventListener('dragleave',e=>{if(!col.contains(e.relatedTarget))col.classList.remove('drag-over')});
      col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('drag-over');if(draggedId)move(draggedId,col.dataset.column)});
    });
    function move(id,status){statuses[id]=status;save();render();toast(`Carte déplacée vers « ${labels[status]} »`)}
    function fillFilters(){
      const cat=$('#categoryFilter'), ven=$('#venueFilter');
      const cats=[...new Set(all().map(a=>a.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
      const venues=[...new Set(all().map(a=>a.venue).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
      const c=cat.value||category,v=ven.value||venue;
      cat.innerHTML='<option value="">Toutes les catégories</option>'+cats.map(x=>`<option${x===c?' selected':''}>${esc(x)}</option>`).join('');
      ven.innerHTML='<option value="">Tous les lieux</option>'+venues.map(x=>`<option${x===v?' selected':''}>${esc(x)}</option>`).join('');
    }
    function byId(id){return all().find(a=>a.id===id)}
    function openDetail(id){
      const a=byId(id); if(!a)return;
      const status=statusOf(a), dlg=$('#detailDialog');
      $('#detailContent').innerHTML=`
        <div class="modal-head"><div><div class="eyebrow">${esc(a.category||'Sortie culturelle')}</div><h2>${esc(a.title)}</h2></div><button class="x" type="button" data-close aria-label="Fermer">×</button></div>
        <p>${esc(a.description||a.why||'')}</p>${a.why&&a.description?`<p><strong>Pourquoi c’est bien :</strong> ${esc(a.why)}</p>`:''}
        <div class="modal-grid">
          <div class="info"><small>Date & heure</small><strong>${esc(dateText(a))}${a.timeLabel?'<br>'+esc(a.timeLabel):''}</strong></div>
          <div class="info"><small>Lieu</small><strong>${esc(a.venue)}<br>${esc(a.address||'Paris')}</strong></div>
          <div class="info"><small>Âge</small><strong>${esc(a.age||'En famille')}</strong></div>
          <div class="info"><small>Prix</small><strong>${esc(a.price||'Voir billetterie')}</strong></div>
        </div>
        <div class="field"><label for="modalStatus">Colonne</label><select id="modalStatus">${Object.entries(labels).map(([k,v])=>`<option value="${k}"${k===status?' selected':''}>${v}</option>`).join('')}</select></div>
        <div class="modal-actions">${a.ticketUrl?`<a class="btn primary" href="${esc(a.ticketUrl)}" target="_blank" rel="noopener">Réserver les billets ${icons.arrow}</a>`:''}${a.sourceUrl?`<a class="btn" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener">Page officielle</a>`:''}${a.custom?`<button class="btn" type="button" data-delete>Supprimer</button>`:''}</div>`;
      $('[data-close]',dlg).onclick=()=>dlg.close();
      $('#modalStatus',dlg).onchange=e=>{move(a.id,e.target.value);dlg.close()};
      const del=$('[data-delete]',dlg);if(del)del.onclick=()=>{custom=custom.filter(x=>x.id!==a.id);delete statuses[a.id];save();dlg.close();render();toast('Activité supprimée')};
      dlg.showModal();
    }
    function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}
    async function refreshCatalog(){
      const btn=$('#refreshBtn');btn.classList.add('refreshing');btn.disabled=true;
      try{
        const res=await fetch(`activities.json?v=${Date.now()}`,{cache:'no-store'});if(!res.ok)throw new Error('fetch');
        const fresh=await res.json();if(!Array.isArray(fresh))throw new Error('format');
        const oldIds=new Set(catalog.map(x=>x.id));catalog=fresh;
        const count=fresh.filter(x=>!oldIds.has(x.id)).length;
        localStorage.setItem(UPDATED_KEY,new Date().toISOString());
        updateSync();render();toast(count?`${count} nouvelle${count>1?'s':''} activité${count>1?'s':''} ajoutée${count>1?'s':''}`:'La sélection est à jour');
      }catch(e){toast('Connexion impossible — les activités enregistrées restent disponibles')}
      finally{btn.classList.remove('refreshing');btn.disabled=false}
    }
    function updateSync(){const v=localStorage.getItem(UPDATED_KEY);if(v){$('#syncStatus').textContent='Actualisé '+new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v)).replace(':','h')}}
    $('#searchInput').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();render()});
    $('#categoryFilter').addEventListener('change',e=>{category=e.target.value;render()});
    $('#venueFilter').addEventListener('change',e=>{venue=e.target.value;render()});
    $('#refreshBtn').addEventListener('click',refreshCatalog);
    $('#addBtn').addEventListener('click',()=>$('#addDialog').showModal());
    $('#addForm').addEventListener('submit',e=>{
      e.preventDefault();
      const title=$('#newTitle').value.trim(), place=$('#newVenue').value.trim();if(!title||!place)return;
      const d=$('#newDate').value;
      const a={id:'custom-'+Date.now(),custom:true,title,venue:place,category:$('#newCategory').value.trim()||'Idée personnelle',start:d?new Date(d).toISOString():null,dateLabel:d?'': 'Date à choisir',age:'En famille',price:$('#newPrice').value.trim()||'À vérifier',ticketUrl:$('#newUrl').value.trim(),description:$('#newDescription').value.trim(),why:$('#newDescription').value.trim(),address:'Paris'};
      custom.push(a);statuses[a.id]='todo';save();e.target.reset();$('#addDialog').close();render();toast('Activité ajoutée à « À faire »');
    });
    $('#exportBtn').addEventListener('click',()=>{
      const payload={exportedAt:new Date().toISOString(),activities:all().map(a=>({...a,status:statusOf(a)}))};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='sorties-frida-paris.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast('Tableau exporté');
    });
    $('#resetBtn').addEventListener('click',e=>{e.preventDefault();if(confirm('Remettre toutes les cartes dans leur état initial ?')){statuses={};custom=[];save();render();toast('Tableau réinitialisé')}});
    $('#sourcesBtn').addEventListener('click',e=>{e.preventDefault();const a=all().find(x=>x.sourceUrl);if(a)openDetail(a.id);toast('Chaque carte contient sa page officielle')});
    $$('#detailDialog,#addDialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}));
    updateSync();render();
  })();