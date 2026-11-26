(function(window,document){
  'use strict';
  if(window.JAInfoToast&&window.JAInfoToast.__sharedController)return;
  var node=null,infoButton=null,timer=null,sequence=0,hideAt=0,activeSource=null,activePriority=0,popoverFailed=false,remembered=null;
  function host(){return document.fullscreenElement||document.body;}
  function ensure(){
    if(!node){node=document.createElement('div');node.id='ja-global-info-toast';node.className='ja-info-toast';node.setAttribute('popover','manual');node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');}
    var target=host();if(node.parentNode!==target)target.appendChild(node);if(infoButton&&infoButton.parentNode!==target)target.appendChild(infoButton);return node;
  }
  function closeLayer(){if(node&&node.hasAttribute('popover')&&typeof node.hidePopover==='function'){try{if(node.matches(':popover-open'))node.hidePopover();}catch(error){}}}
  function openLayer(){
    if(!node||popoverFailed||!node.hasAttribute('popover'))return true;
    if(typeof node.showPopover!=='function'){popoverFailed=true;node.removeAttribute('popover');return true;}
    try{closeLayer();node.showPopover();return true;}catch(error){popoverFailed=true;try{node.removeAttribute('popover');}catch(ignore){}return true;}
  }
  function ensureInfoButton(){
    if(!infoButton){infoButton=document.createElement('button');infoButton.type='button';infoButton.id='ja-global-info-recall';infoButton.textContent='i';infoButton.setAttribute('aria-label','Show latest planetary verification status');infoButton.title='Show latest planetary verification status';infoButton.addEventListener('click',function(){if(remembered)show(remembered.message,remembered.options);});}
    var target=host();if(infoButton.parentNode!==target)target.appendChild(infoButton);
  }
  function clearTimer(){if(timer){window.clearTimeout(timer);timer=null;}}
  function hide(source){
    if(source&&source!==activeSource)return false;
    sequence++;clearTimer();if(node){node.classList.remove('is-visible');closeLayer();}
    activeSource=null;activePriority=0;hideAt=0;return true;
  }
  function show(message,options){
    options=options||{};var source=String(options.source||'general'),priority=Math.max(0,Number(options.priority)||0);
    if(node&&node.classList.contains('is-visible')&&priority<activePriority)return false;
    var id=++sequence,el=ensure(),duration=Math.max(500,Number(options.duration)||2500);
    activeSource=source;activePriority=priority;hideAt=Date.now()+duration;el.textContent=String(message==null?'':message);if(options.remember){remembered={message:el.textContent,options:{source:source,priority:priority,duration:duration,variant:options.variant,position:options.position}};ensureInfoButton();}
    el.dataset.position='bottom';el.classList.toggle('is-warning',options.variant==='warning');el.classList.toggle('is-success',options.variant==='success');
    el.classList.remove('is-visible');openLayer();void el.offsetWidth;el.classList.add('is-visible');clearTimer();
    timer=window.setTimeout(function(){if(id===sequence&&Date.now()>=hideAt)hide(source);},duration);return true;
  }
  function relocate(){
    if(!node)return;
    if(!node.classList.contains('is-visible')){if(infoButton){var target=host();if(infoButton.parentNode!==target)target.appendChild(infoButton);}return;}
    var remaining=Math.max(100,hideAt-Date.now()),source=activeSource,id=sequence;clearTimer();closeLayer();ensure();openLayer();
    window.requestAnimationFrame(function(){if(id!==sequence||!node)return;node.classList.add('is-visible');timer=window.setTimeout(function(){if(id===sequence)hide(source);},remaining);});
  }
  document.addEventListener('fullscreenchange',relocate);
  window.addEventListener('pagehide',function(){hide();});
  window.JAInfoToast={show:show,hide:hide,__sharedController:true};
})(window,document);
