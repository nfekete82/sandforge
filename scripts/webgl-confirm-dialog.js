/**
 * Sandforge in-game confirmation dialog.
 * Unlike window.confirm(), it uses the HUD palette, stays at screen center,
 * traps browser focus and never lets combat/production clicks leak through.
 */
export function createSandforgeConfirmDialog(parent,{onChange=()=>{}}={}){
 if(!parent)throw new Error('Confirmation dialog needs HUD parent');
 const dialog=document.createElement('dialog');
 dialog.id='sf-confirm-dialog';
 dialog.className='sf-confirm-dialog';
 dialog.setAttribute('aria-labelledby','sf-confirm-title');
 dialog.setAttribute('aria-describedby','sf-confirm-description');
 dialog.innerHTML=`
  <div class="sf-confirm-heading">
   <small>SANDFORGE / TAKTISCHE BESTÄTIGUNG</small>
   <h2 id="sf-confirm-title"></h2>
  </div>
  <p id="sf-confirm-description"></p>
  <div class="sf-confirm-actions">
   <button type="button" data-sf-confirm="cancel">ABBRECHEN</button>
   <button type="button" data-sf-confirm="approve">BESTÄTIGEN</button>
  </div>`;
 parent.append(dialog);
 const cancel=dialog.querySelector('[data-sf-confirm="cancel"]');
 const approve=dialog.querySelector('[data-sf-confirm="approve"]');
 let pending=null,previousFocus=null;
 function finish(accepted){
  if(!pending)return;
  const resolve=pending;pending=null;
  dialog.close();
  onChange(false);
  previousFocus?.focus?.({preventScroll:true});
  resolve(Boolean(accepted));
 }
 dialog.addEventListener('cancel',event=>{
  event.preventDefault();
  finish(false);
 });
 dialog.addEventListener('click',event=>{
  event.stopPropagation();
  const button=event.target.closest('[data-sf-confirm]');
  if(button)finish(button.dataset.sfConfirm==='approve');
 });
 // Prevent the preview's WASD/Space/gameplay shortcuts while the modal has focus.
 dialog.addEventListener('keydown',event=>event.stopPropagation());
 return {
  ask({title='BESTÄTIGEN',description='',confirmLabel='BESTÄTIGEN',danger=false}={}){
   if(pending)return Promise.resolve(false);
   dialog.querySelector('#sf-confirm-title').textContent=title;
   dialog.querySelector('#sf-confirm-description').textContent=description;
   approve.textContent=confirmLabel;
   dialog.classList.toggle('sf-confirm-danger',Boolean(danger));
   previousFocus=document.activeElement;
   return new Promise(resolve=>{
    pending=resolve;
    dialog.showModal();
    onChange(true);
    cancel.focus();
   });
  },
  get open(){return dialog.open;}
 };
}
