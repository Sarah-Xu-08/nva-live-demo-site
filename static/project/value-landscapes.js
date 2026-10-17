/* Overview only: editable continuous RL illustration; no session or EEG access. */
import {CURRENT_STATE,createExamples,trajectory,predictionErrors,rotate,extent,wrapAngle} from './value-landscapes-model.mjs?v=5';

(() => {
  const root=document.getElementById('nv-value-landscapes');
  if(!root)return;
  const panel=root.querySelector('.nve-panel'),stage=root.querySelector('.nve-stage'),svg=root.querySelector('.nve-plot');
  const q=s=>root.querySelector(s),qa=s=>[...root.querySelectorAll(s)];
  const measure=document.createElement('canvas').getContext('2d');
  const current=CURRENT_STATE,presets=createExamples();
  let state={...structuredClone(presets.goals),selected:'ai',part:'step',editing:false,example:'goals'};
  let geometry=null,drag=null,drawFrame=0,statusTimer=0;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const humanName=id=>id==='human'?'Human':'AI';
  const close=(a,b)=>Math.abs(a-b)<1e-9;
  const fixed=(v,n=3)=>v==null?'—':!Number.isFinite(v)?(v<0?'−∞':'∞'):(Math.abs(v)<.5*10**(-n)?0:v).toFixed(n).replace('-','−');
  const signed=v=>v==null?'—':!Number.isFinite(v)?(v>0?'+∞':'−∞'):Math.abs(v)<.0005?'0.000':(v>0?'+':'−')+Math.abs(v).toFixed(3);
  const shapeSize=(value,max)=>clamp(Math.round(value/.005)*.005,0,max);
  function calculate(){return predictionErrors(state.human,state.ai,current);}
  function canEditShape(){return state.part==='goal'||state.selected==='human';}
  function announce(){
    clearTimeout(statusTimer);
    statusTimer=setTimeout(()=>{const c=calculate();q('[data-status]').textContent=`${humanName(state.selected)} adjusted. RPE ${signed(c.rpe)}. SPE ${fixed(c.spe)}. ${c.withinHumanTolerance?'Within':'Outside'} human next-step tolerance.`;},180);
  }
  function fitDomain(paths){
    const xs=[-.08,1.12],ys=[-.08,1.12];
    for(const id of ['human','ai']){
      const m=state[id],g=extent(m.wx,m.wy,m.goalAngle);
      xs.push(m.gx-g.rx,m.gx+g.rx);ys.push(m.gy-g.ry,m.gy+g.ry);
      if(id==='human'){
        const t=extent(m.tx,m.ty,m.toleranceAngle);
        xs.push(m.step.x-t.rx,m.step.x+t.rx);ys.push(m.step.y-t.ry,m.step.y+t.ry);
      }
      for(const p of paths[id]){xs.push(p.x);ys.push(p.y);}
    }
    return {xmin:Math.min(...xs)-.06,xmax:Math.max(...xs)+.06,ymin:Math.min(...ys)-.09,ymax:Math.max(...ys)+.09};
  }
  function putButton(button,p){button.style.left=`${geometry.x(p.x)}px`;button.style.top=`${geometry.y(p.y)}px`;}
  function shapeHandles(model,part){
    const isGoal=part==='goal',center=isGoal?{x:model.gx,y:model.gy}:model.step;
    const angle=isGoal?model.goalAngle:model.toleranceAngle;
    const centerPx={x:geometry.x(center.x),y:geometry.y(center.y)},handles={};
    const penalty=p=>Math.max(0,17-p.x)+Math.max(0,p.x-geometry.width+17)+Math.max(0,17-p.y)+Math.max(0,p.y-geometry.height+17);
    for(const axis of ['x','y']){
      const key=isGoal?(axis==='x'?'wx':'wy'):(axis==='x'?'tx':'ty');
      const delta=rotate(axis==='x'?{x:model[key],y:0}:{x:0,y:model[key]},angle);
      const edge={x:geometry.x(center.x+delta.x)-centerPx.x,y:geometry.y(center.y+delta.y)-centerPx.y};
      const direction=rotate(axis==='x'?{x:1,y:0}:{x:0,y:1},angle);
      const radius=Math.hypot(edge.x,edge.y),unit={x:direction.x,y:-direction.y};
      const length=Math.max(36,radius),extra=axis==='y'?32:0;
      const at=(distance,sign)=>({x:centerPx.x+sign*unit.x*distance,y:centerPx.y+sign*unit.y*distance});
      let sign=isGoal&&axis==='x'?-1:1;
      if(penalty(at(length+extra,-sign))<penalty(at(length+extra,sign)))sign=-sign;
      handles[key]={...at(length,sign),edge:at(radius,sign),sign};
      if(axis==='y')handles[isGoal?'goalAngle':'toleranceAngle']={...at(length+32,sign),edge:at(length,sign),sign};
    }
    return handles;
  }
  function draw(){
    drawFrame=0;
    if(!canEditShape())state.editing=false;
    const width=stage.clientWidth,height=stage.clientHeight;if(!width)return;
    const compact=width<410,paths={human:trajectory(state.human),ai:trajectory(state.ai)},c=calculate();
    const bounds=drag?.domain||fitDomain(paths);
    const box={left:compact?12:20,right:compact?12:20,top:25,bottom:25};
    const pw=width-box.left-box.right,ph=height-box.top-box.bottom;
    // Expand the visible domain to preserve one pixel scale for both axes.
    const scale=Math.min(pw/(bounds.xmax-bounds.xmin),ph/(bounds.ymax-bounds.ymin));
    const cx=(bounds.xmin+bounds.xmax)/2,cy=(bounds.ymin+bounds.ymax)/2;
    const domain={xmin:cx-pw/(2*scale),xmax:cx+pw/(2*scale),ymin:cy-ph/(2*scale),ymax:cy+ph/(2*scale)};
    geometry={...domain,width,height,compact,pw,ph,...box,x:v=>box.left+(v-domain.xmin)/(domain.xmax-domain.xmin)*pw,y:v=>box.top+(domain.ymax-v)/(domain.ymax-domain.ymin)*ph,ix:v=>domain.xmin+(v-box.left)/pw*(domain.xmax-domain.xmin),iy:v=>domain.ymax-(v-box.top)/ph*(domain.ymax-domain.ymin)};
    const {x,y}=geometry;
    const selected=state[state.selected],coarse=window.matchMedia('(pointer:coarse)').matches;
    const sx=pw/(domain.xmax-domain.xmin),sy=ph/(domain.ymax-domain.ymin);
    const toleranceRadii=m=>{const r=extent(m.tx,m.ty,m.toleranceAngle);return{rx:r.rx*sx,ry:r.ry*sy};};
    geometry.shapeHandles=canEditShape()?shapeHandles(selected,state.part):{};
    const shared=['gx','gy','wx','wy','goalAngle'].every(k=>close(state.human[k],state.ai[k]));
    const sameState=Math.hypot(c.dx,c.dy)<.00001;
    const drawOrder=['human','ai'].sort((a,b)=>(a===state.selected?1:0)-(b===state.selected?1:0));
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('width',width);svg.setAttribute('height',height);
    let markup=`<title id="nve-title">Human and AI goals, trajectories, and next-step tolerance</title><desc id="nve-description">Each path starts at the same state, passes through its freely positioned next-state point, then converges to its own goal. Blue goal regions match the RPE color. The pink human next-step tolerance ellipse matches the SPE color. These regions fade from center to edge. The AI-observed state is a single square with no distribution. Light-grey paths and circular goal and state markers identify the human; black paths and square goal and state markers identify AI, with inverted contrast in dark mode. Solid segments show the current-to-next transition; dashed segments show possible continuation. RPE compares the AI trajectory’s discounted return with the human-expected return, both using human rewards. RPE is ${signed(c.rpe)} and human-tolerance-normalized SPE is ${fixed(c.spe)}; the tolerance boundary is 1. The AI next-state center is ${c.withinHumanTolerance?'within':'outside'} human tolerance.</desc><defs><clipPath id="nve-clip"><rect x="1" y="1" width="${width-2}" height="${height-2}"/></clipPath><radialGradient id="nve-goal-gradient"><stop offset="0%" stop-color="var(--nve-blue)" stop-opacity=".40"/><stop offset="40%" stop-color="var(--nve-blue)" stop-opacity=".23"/><stop offset="78%" stop-color="var(--nve-blue)" stop-opacity=".08"/><stop offset="100%" stop-color="var(--nve-blue)" stop-opacity="0"/></radialGradient><radialGradient id="nve-step-gradient"><stop offset="0%" stop-color="var(--nve-pink)" stop-opacity=".46"/><stop offset="40%" stop-color="var(--nve-pink)" stop-opacity=".24"/><stop offset="78%" stop-color="var(--nve-pink)" stop-opacity=".08"/><stop offset="100%" stop-color="var(--nve-pink)" stop-opacity="0"/></radialGradient></defs>`;
    markup+='<g clip-path="url(#nve-clip)">';
    for(const gx of [0,.2,.4,.6,.8,1])for(const gy of [0,.2,.4,.6,.8,1])markup+=`<circle cx="${x(gx)}" cy="${y(gy)}" r=".8" fill="var(--nve-line)"/>`;
    for(const id of drawOrder){
      const m=state[id],angle=m.goalAngle*Math.PI/180,ca=Math.cos(angle),sa=Math.sin(angle),editing=state.editing&&state.part==='goal'&&id===state.selected;
      markup+=`<ellipse class="nve-value-area" data-contour="${id}" data-editing="${editing}" cx="0" cy="0" rx="${m.wx}" ry="${m.wy}" transform="matrix(${sx*ca} ${-sy*sa} ${-sx*sa} ${-sy*ca} ${x(m.gx)} ${y(m.gy)})" fill="url(#nve-goal-gradient)" fill-opacity="${shared&&id===state.selected?0:1}" stroke="${editing?'var(--nve-blue)':'none'}" stroke-opacity=".6" stroke-width="1" vector-effect="non-scaling-stroke" ${id==='ai'?'stroke-dasharray="5 4"':''}/>`;
      markup+=collapsedShape({x:m.gx,y:m.gy},m.wx,m.wy,m.goalAngle,'blue',editing);
    }
    {
      const m=state.human,angle=m.toleranceAngle*Math.PI/180,ca=Math.cos(angle),sa=Math.sin(angle),editing=state.editing&&state.part==='step'&&state.selected==='human';
      markup+=`<ellipse class="nve-tolerance-area" data-tolerance="human" data-editing="${editing}" cx="0" cy="0" rx="${m.tx}" ry="${m.ty}" transform="matrix(${sx*ca} ${-sy*sa} ${-sx*sa} ${-sy*ca} ${x(m.step.x)} ${y(m.step.y)})" fill="url(#nve-step-gradient)" stroke="${editing?'var(--nve-pink)':'none'}" stroke-opacity=".7" stroke-width="1.15" vector-effect="non-scaling-stroke"/>`;
      markup+=collapsedShape(m.step,m.tx,m.ty,m.toleranceAngle,'pink',editing);
    }
    for(const id of ['human','ai']){
      const points=paths[id],color=id==='human'?'var(--nve-human)':'var(--nve-ai)';
      const path=points.slice(1).map((p,i)=>`${i?'L':'M'}${x(p.x)},${y(p.y)}`).join(' ');
      markup+=`<path data-path="${id}" d="${path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5 4"/>`;
      const p=points[1];
      markup+=`<path data-transition="${id}" d="M${x(current.x)},${y(current.y)}L${x(p.x)},${y(p.y)}" fill="none" stroke="${color}" stroke-width="2.2"/>`;
      const px=x(current.x)+(x(p.x)-x(current.x))*.76,py=y(current.y)+(y(p.y)-y(current.y))*.76;
      const angle=Math.atan2(y(p.y)-y(current.y),x(p.x)-x(current.x));
      markup+=`<path d="M${px-6*Math.cos(angle)+3*Math.sin(angle)},${py-6*Math.sin(angle)-3*Math.cos(angle)}L${px},${py}L${px-6*Math.cos(angle)-3*Math.sin(angle)},${py-6*Math.sin(angle)+3*Math.cos(angle)}" fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`;
      for(let i=2;i<5;i++)markup+=`<circle cx="${x(points[i].x)}" cy="${y(points[i].y)}" r="1.8" fill="var(--nve-bg)" stroke="${color}" stroke-width=".8"/>`;
    }
    if(!sameState)markup+=`<line data-state-gap="true" x1="${x(c.expected.x)}" y1="${y(c.expected.y)}" x2="${x(c.observed.x)}" y2="${y(c.observed.y)}" stroke="var(--nve-pink)" stroke-width="1.4" stroke-dasharray="3 3"/>`;
    if(state.editing&&!coarse){
      const leaders=Object.values(geometry.shapeHandles).map(h=>`M${h.edge.x},${h.edge.y}L${h.x},${h.y}`).join('');
      markup+=`<path data-editing-leaders d="${leaders}" fill="none" stroke="${state.part==='goal'?'var(--nve-blue)':'var(--nve-pink)'}" stroke-opacity=".6" stroke-width="1" pointer-events="none"/>`;
    }
    markup+=`<circle cx="${x(current.x)}" cy="${y(current.y)}" r="4" fill="var(--nve-ink)"/>`;
    markup+='</g>';
    // Place direct labels around actual data and handles, with generous collision margins.
    const labels=[];
    const points=[current,c.expected,c.observed,{x:state.human.gx,y:state.human.gy},{x:state.ai.gx,y:state.ai.gy}];
    if(state.editing&&!coarse)for(const h of Object.values(geometry.shapeHandles))points.push({x:geometry.ix(h.x),y:geometry.iy(h.y)});
    function label(text,p,offsets,muted=false){
      measure.font=`${muted?11:12}px ${getComputedStyle(panel).fontFamily}`;
      const tw=measure.measureText(text).width,th=14;
      let best=null;
      const candidates=[...offsets,...offsets.flatMap(([ox,oy])=>[[ox-26,oy],[ox+26,oy]]),[0,-100],[0,100],[-tw/2-28,4],[tw/2+28,4]];
      candidates.forEach(([ox,oy],index)=>{
        const px=clamp(x(p.x)+ox,tw/2+3,width-tw/2-3),py=clamp(y(p.y)+oy,17,height-5);
        const rect={x:px-tw/2,y:py-th,w:tw,h:th};
        let penalty=index*.1;
        for(const b of labels)if(rect.x<b.x+b.w+7&&rect.x+rect.w>b.x-7&&rect.y<b.y+b.h+7&&rect.y+rect.h>b.y-7)penalty+=1000;
        for(const b of points){const bx=x(b.x),by=y(b.y);if(bx>rect.x-12&&bx<rect.x+rect.w+12&&by>rect.y-12&&by<rect.y+rect.h+12)penalty+=40;}
        if(!best||penalty<best.penalty)best={rect,px,py,penalty};
      });
      labels.push(best.rect);
      return `<text class="nve-label ${muted?'nve-muted-label':''}" x="${best.px}" y="${best.py}" text-anchor="middle">${text}</text>`;
    }
    if(shared)markup+=label('Shared goal',{x:state.human.gx,y:state.human.gy},[[0,-34],[0,42],[0,-65],[0,70]],true);
    else{
      markup+=label('Human goal',{x:state.human.gx,y:state.human.gy},[[0,-30],[0,36],[0,-58],[0,65]],true);
      markup+=label('AI goal',{x:state.ai.gx,y:state.ai.gy},[[0,36],[0,-30],[0,65],[0,-58]],true);
    }
    markup+=label('Current state',current,[[0,29],[0,-22],[-32,34],[28,37]],true);
    const rh=toleranceRadii(state.human),matchedHeight=rh.ry;
    if(sameState)markup+=label('Expected = observed',c.expected,[[0,-matchedHeight-20],[0,matchedHeight+25],[0,-matchedHeight-48],[0,matchedHeight+54]],true);
    else{
      markup+=label(compact?'Expected':'Human expected',c.expected,[[0,-rh.ry-20],[-35,-rh.ry-30],[0,rh.ry+25],[0,-rh.ry-48],[0,rh.ry+54]],true);
      markup+=label(compact?'Observed':'AI observed',c.observed,[[0,25],[35,35],[0,-20],[0,54],[0,-48]],true);
    }
    svg.innerHTML=markup;
    for(const id of ['human','ai']){
      const m=state[id],goal=q(`[data-drag="goal"][data-owner="${id}"]`),step=q(`[data-drag="step"][data-owner="${id}"]`);
      putButton(goal,{x:m.gx,y:m.gy});putButton(step,id==='human'?c.expected:c.observed);
      goal.dataset.x=m.gx;goal.dataset.y=m.gy;step.dataset.x=m.step.x;step.dataset.y=m.step.y;
      goal.dataset.selected=String(state.selected===id);step.dataset.selected=String(state.selected===id);step.dataset.matched=String(sameState);
    }
    const model=state[state.selected];
    for(const prop of ['wx','wy','tx','ty','goalAngle','toleranceAngle']){
      const button=q(`[data-drag="${prop}"]`),position=geometry.shapeHandles[prop];
      button.hidden=!state.editing||!position;
      if(position){button.style.left=`${position.x}px`;button.style.top=`${position.y}px`;}
    }
    for(const button of qa('[data-agent]'))button.setAttribute('aria-pressed',String(button.dataset.agent===state.selected));
    for(const button of qa('button[data-example]'))button.setAttribute('aria-pressed',String(button.dataset.example===state.example));
    for(const button of qa('button[data-part]')){
      button.hidden=button.dataset.part==='step'&&state.selected==='ai';
      button.setAttribute('aria-pressed',String(!button.hidden&&button.dataset.part===state.part));
    }
    q('[data-selected-label]').textContent=`${humanName(state.selected)} selected`;
    q('.nve-sliders').dataset.part=state.part;q('.nve-sliders').hidden=!state.editing;q('[data-curve-control]').hidden=state.part==='step';
    if(canEditShape()){
      for(const [control,goalProp,stepProp,axis] of [['wx','wx','tx','width'],['wy','wy','ty','height']]){
        const input=q(`[data-property="${control}"]`),isStep=state.part==='step',prop=isStep?stepProp:goalProp;
        input.min=0;input.max=isStep?.26:.38;input.value=model[prop];
        input.setAttribute('aria-label',`Selected ${isStep?'next-step tolerance':'goal tolerance'} ${axis}`);
        q(`[data-${control}-value]`).textContent=fixed(model[prop]);
      }
      const shapeAngle=model[state.part==='goal'?'goalAngle':'toleranceAngle'];
      q('[data-property="angle"]').value=shapeAngle;q('[data-angle-value]').textContent=`${Math.round(shapeAngle)}°`;
      q('[data-property="angle"]').setAttribute('aria-label',`Selected ${state.part==='goal'?'goal':'next-step tolerance'} rotation in degrees`);
      q('[data-property="bend"]').value=model.bend;q('[data-bend-value]').textContent=`${Math.round(model.bend)}°`;
    }
    q('[data-rpe]').textContent=signed(c.rpe);q('[data-spe]').textContent=fixed(c.spe);
    q('[data-rpe-interpretation]').textContent=c.rpe==null?'Zero goal tolerance: return comparison undefined':c.rpe<-.0005?'Lower return than expected':c.rpe>.0005?'Higher return than expected':'Same return as expected';
    q('[data-spe-interpretation]').textContent=`${c.withinHumanTolerance?'Within':'Outside'} human tolerance · boundary: 1`;
    q('[data-example-note]').hidden=!(sameState&&(!close(state.human.gx,state.ai.gx)||!close(state.human.gy,state.ai.gy)));
    panel.dataset.example=state.example;panel.dataset.selected=state.selected;panel.dataset.matched=String(sameState);panel.dataset.part=state.part;panel.dataset.editing=String(state.editing);
  }
  function schedule(){if(!drawFrame)drawFrame=requestAnimationFrame(draw);}
  function collapsedShape(center,rx,ry,angle,color,editing){
    if(rx>0&&ry>0||rx===0&&ry===0)return '';
    const d=rotate({x:rx,y:ry},angle),{x,y}=geometry;
    return `<path data-collapsed-shape d="M${x(center.x-d.x)},${y(center.y-d.y)}L${x(center.x+d.x)},${y(center.y+d.y)}" fill="none" stroke="var(--nve-${color})" stroke-width="1" stroke-opacity="${editing?.65:.25}" pointer-events="none"/>`;
  }
  function finish(){draw();announce();}
  function local(event){const b=stage.getBoundingClientRect();return{x:geometry.ix(event.clientX-b.left),y:geometry.iy(event.clientY-b.top)};}
  function clampPoint(point){
    const coarse=window.matchMedia('(pointer:coarse)').matches,margin=coarse?22:19;
    return {x:clamp(point.x,geometry.ix(margin),geometry.ix(geometry.width-margin)),y:clamp(point.y,geometry.iy(geometry.height-margin),geometry.iy(margin))};
  }
  function changeGoal(model,x,y){
    const point=clampPoint({x,y});
    model.gx=point.x;model.gy=point.y;
  }
  function changeStep(id,p,snap=false){
    const coarse=window.matchMedia('(pointer:coarse)').matches;
    let point=clampPoint(p);
    if(snap){
      const other=state[id==='human'?'ai':'human'].step;
      const distance=Math.hypot(geometry.x(point.x)-geometry.x(other.x),geometry.y(point.y)-geometry.y(other.y));
      if(distance<(coarse?18:11))point={...other};
    }
    state[id].step=point;
  }
  root.addEventListener('click',event=>{
    const agent=event.target.closest('button[data-agent]'),example=event.target.closest('button[data-example]'),part=event.target.closest('button[data-part]');
    if(agent){state.selected=agent.dataset.agent;finish();}
    if(example){const which=example.dataset.example;state={...structuredClone(presets[which]),selected:state.selected,part:state.part,editing:false,example:which};finish();}
    if(part){state.part=part.dataset.part;state.editing=canEditShape();finish();}
    if(event.detail===0){const handle=event.target.closest('button[data-drag][data-owner]');if(handle){state.selected=handle.dataset.owner;state.part=handle.dataset.drag;state.editing=canEditShape();finish();}}
  });
  root.addEventListener('input',event=>{
    const prop=event.target.dataset.property;if(!prop||!canEditShape())return;
    const key=prop==='angle'?(state.part==='goal'?'goalAngle':'toleranceAngle'):(state.part==='step'?({wx:'tx',wy:'ty'}[prop]||prop):prop);
    state[state.selected][key]=Number(event.target.value);state.example='custom';draw();
  });
  root.addEventListener('change',event=>{if(event.target.dataset.property)announce();});
  stage.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const handle=event.target.closest('[data-drag]'),contour=event.target.closest('[data-contour]'),tolerance=event.target.closest('[data-tolerance]');
    if(!handle&&!contour&&!tolerance){if(state.editing){state.editing=false;finish();}return;}
    const agent=handle?.dataset.owner||tolerance?.dataset.tolerance||contour?.dataset.contour||state.selected;
    const kind=handle?.dataset.drag||(tolerance?'step':'goal');state.selected=agent;state.part=['goal','wx','wy','goalAngle'].includes(kind)?'goal':'step';
    const moving=kind==='goal'||kind==='step';
    drag={pointer:event.pointerId,agent,kind,moving,moved:false,screenOrigin:{x:event.clientX,y:event.clientY},origin:local(event),model:structuredClone(state[agent]),sign:geometry.shapeHandles[kind]?.sign||1,domain:{xmin:geometry.xmin,xmax:geometry.xmax,ymin:geometry.ymin,ymax:geometry.ymax}};
    state.editing=!moving;
    stage.setPointerCapture(event.pointerId);event.preventDefault();draw();
  });
  stage.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointer)return;
    if(!drag.moved&&Math.hypot(event.clientX-drag.screenOrigin.x,event.clientY-drag.screenOrigin.y)<3)return;
    drag.moved=true;
    const p=local(event),m=state[drag.agent];
    if(drag.kind==='goal')changeGoal(m,drag.model.gx+p.x-drag.origin.x,drag.model.gy+p.y-drag.origin.y);
    if(['wx','wy','tx','ty'].includes(drag.kind)){
      const goal=drag.kind.startsWith('w'),angle=goal?drag.model.goalAngle:drag.model.toleranceAngle;
      const delta=rotate({x:p.x-drag.origin.x,y:p.y-drag.origin.y},-angle),axis=drag.kind.endsWith('x')?'x':'y';
      m[drag.kind]=shapeSize(drag.model[drag.kind]+drag.sign*delta[axis],goal?.38:.26);
    }
    if(['goalAngle','toleranceAngle'].includes(drag.kind)){
      const center=drag.kind==='goalAngle'?{x:drag.model.gx,y:drag.model.gy}:drag.model.step;
      const startAngle=Math.atan2(drag.origin.y-center.y,drag.origin.x-center.x),nowAngle=Math.atan2(p.y-center.y,p.x-center.x);
      m[drag.kind]=wrapAngle(drag.model[drag.kind]+(nowAngle-startAngle)*180/Math.PI);
    }
    if(drag.kind==='step'){
      changeStep(drag.agent,{x:drag.model.step.x+p.x-drag.origin.x,y:drag.model.step.y+p.y-drag.origin.y},!event.shiftKey);
    }
    state.example='custom';schedule();
  });
  function end(event){if(!drag||event.pointerId!==drag.pointer)return;const tap=drag.moving&&!drag.moved&&event.type==='pointerup';drag=null;if(tap)state.editing=canEditShape();if(stage.hasPointerCapture(event.pointerId))stage.releasePointerCapture(event.pointerId);finish();}
  stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);
  stage.addEventListener('lostpointercapture',event=>{if(drag&&event.pointerId===drag.pointer){drag=null;finish();}});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&state.editing){state.editing=false;finish();return;}
    const handle=event.target.closest('[data-drag]');if(!handle||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();const id=handle.dataset.owner||state.selected,kind=handle.dataset.drag,m=state[id];state.selected=id;state.part=['goal','wx','wy','goalAngle'].includes(kind)?'goal':'step';state.editing=!['goal','step'].includes(kind);
    const sign=['ArrowUp','ArrowRight'].includes(event.key)?1:-1;
    if(kind==='goal'){
      const amount=event.shiftKey?.05:.01;
      changeGoal(m,m.gx+(['ArrowRight','ArrowLeft'].includes(event.key)?sign*amount:0),m.gy+(['ArrowUp','ArrowDown'].includes(event.key)?sign*amount:0));
    }else if(kind==='step'){
      const amount=event.shiftKey?.05:.01;
      changeStep(id,{x:m.step.x+(['ArrowRight','ArrowLeft'].includes(event.key)?sign*amount:0),y:m.step.y+(['ArrowUp','ArrowDown'].includes(event.key)?sign*amount:0)});
    }
    else if(['goalAngle','toleranceAngle'].includes(kind))m[kind]=wrapAngle(m[kind]+sign*(event.shiftKey?10:1));
    else m[kind]=shapeSize(m[kind]+sign*(event.shiftKey?.02:.005),['tx','ty'].includes(kind)?.26:.38);
    state.example='custom';finish();
  });
  new ResizeObserver(schedule).observe(stage);
  draw();
})();
