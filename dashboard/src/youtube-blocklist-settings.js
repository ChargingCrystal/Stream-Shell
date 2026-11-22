function renderYoutubeBlocklistSettings() {
    return `<section class="settings-group settings-group-page ss-filter-page" data-youtube-blocklist>
        <div class="settings-group-heading ss-filter-heading"><h2>Filter lists</h2><div class="ss-filter-actions">
        <label class="ss-filter-enable">Enable filters<span class="settings-switch"><input type="checkbox" role="switch" data-blocklist-enabled><span aria-hidden="true"></span></span></label>
        <button type="button" class="settings-provider-registry-move" data-blocklist-import>Import JSON list</button></div></div>
        <p data-blocklist-status role="status"></p><div data-blocklist-lists></div>
        <p class="ss-filter-help">Each import adds a separate list. Remove takes priority when lists overlap; otherwise the first matching list supplies the blur text.</p>
        <input type="file" accept=".json,application/json" data-blocklist-file hidden></section>`;
}
async function mountYoutubeBlocklistSettings(root) {
    const host=root.querySelector('[data-youtube-blocklist]'); if(!host)return;
    const status=host.querySelector('[data-blocklist-status]'), file=host.querySelector('[data-blocklist-file]'), enabled=host.querySelector('[data-blocklist-enabled]');
    let busy=false;
    async function api(action,payload={}) {
        if(busy)return; busy=true;
        host.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
        try {
            const result=await chrome.runtime.sendMessage({type:'youtube-blocklist-api',action,...payload});
            if(!result?.ok)throw Error(result?.error || 'Filter service unavailable.');
            render(result.state);status.textContent='';
        } catch(error){status.textContent=error.message;}
        finally {busy=false;host.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);}
    }
    function render(state) {
        enabled.checked=state.enabled;
        const list=host.querySelector('[data-blocklist-lists]');list.replaceChildren();
        for(const entry of state.lists){
            const row=document.createElement('div');row.className='ss-filter-list-row';
            const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=entry.enabled;toggle.setAttribute('aria-label','Enable '+entry.list.title);
            const toggleWrap=document.createElement('label');toggleWrap.className='settings-switch';toggle.setAttribute('role','switch');const track=document.createElement('span');track.setAttribute('aria-hidden','true');toggleWrap.append(toggle,track);
            const title=document.createElement('span');title.className='ss-filter-title';title.textContent=`${entry.list.title} · ${entry.list.channels.length} channels`;
            const mode=document.createElement('select');mode.setAttribute('aria-label','Filter action');
            for(const [value,label] of [['blur','Blur'],['remove','Remove']]){const option=document.createElement('option');option.value=value;option.textContent=label;mode.append(option);}mode.value=entry.mode;
            const text=document.createElement('input');text.type='text';text.maxLength=200;text.value=entry.text;text.placeholder='Blur label';text.setAttribute('aria-label','Blur label');text.disabled=entry.mode==='remove';text.style.visibility=entry.mode==='remove'?'hidden':'';
            const remove=document.createElement('button');remove.type='button';remove.className='settings-provider-registry-move ss-filter-delete';remove.setAttribute('aria-label','Delete '+entry.list.title);remove.textContent='×';remove.title='Delete list';
            toggle.onchange=()=>api('update',{listId:entry.id,enabled:toggle.checked});
            mode.onchange=()=>api('update',{listId:entry.id,mode:mode.value,text:text.value});
            text.onchange=()=>api('update',{listId:entry.id,text:text.value});
            remove.onclick=()=>api('remove',{listId:entry.id});
            row.append(toggleWrap,title,mode,text,remove);list.append(row);
        }
        if(!state.lists.length)list.textContent='No filter lists imported.';
    }
    host.querySelector('[data-blocklist-import]').onclick=()=>file.click();
    file.onchange=async()=>{const selected=file.files[0];if(!selected)return;try{if(selected.size>5*1024*1024)throw Error('Maximum JSON size is 5 MB.');await api('import',{data:JSON.parse(await selected.text())});}catch(e){status.textContent=e.message;}file.value='';};
    enabled.onchange=()=>api('enable',{enabled:enabled.checked});
    await api('get');
}
