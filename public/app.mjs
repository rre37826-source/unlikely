import { EXAMPLES } from './examples.mjs';
import { text, validateGraph, validateProject, routeEdges, findShortestPath, routeToMarkdown, routeMatches } from './core.mjs';
import { REPOSITORY_URL } from './config.mjs';

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const STORE = 'unlikely.workspace.v1';
const palette = ['#cfce86','#7fcabf','#abbadd','#d0a0ba','#d2ae80','#a2c895'];
let lang = localStorageSafe('unlikely.language') || (navigator.language.startsWith('zh') ? 'zh' : 'en');
let exampleId = EXAMPLES[0].id;
let project = fromExample(EXAMPLES[0]);
let selectedNode = project.graph.seedId;
let selectedEdge = null;
let tab = 'explore';
let brief = null;
let briefSource = '';
let provider = { configured: false, model: null };
let camera = { x: 0, y: 0, scale: 1 };
let positions = new Map();
let nodeElements = new Map();
let pathElements = new Map();
let requestController = null;
let noticeTimer;
let tourTimers = [];
let pendingBridge = null;
let persistenceAvailable = true;

const copy = {
  tagline:['A map of possibilities','把可能性展开'],watch:['20-second tour','20 秒看懂'],newTask:['Your own task','输入你的任务'],
  canvasHint:['Follow your curiosity. Every line has a reason.','沿着好奇心探索，每条连接都有理由。'],association:['Association','关联'],analogy:['Analogy / hypothesis','类比 / 假设'],fit:['Fit map','查看全图'],
  tryPath:['TAKE A DIFFERENT PATH','从另一条路出发'],examplesHint:['Two starting points. Your choices make the difference.','两个起点，往不同的方向走。'],inspect:['Explore','探索关联'],myRoute:['My route','我的路线'],
  connectedIdeas:['CONNECTED IDEAS','与它相连'],keepExploring:['KEEP EXPLORING','继续探索'],deepen:['Go deeper','向下深挖'],goFurther:['Find a distant analogy','寻找远处的类比'],invert:['Reverse it','反过来想'],
  yourChoices:['YOUR CHOICES, CONNECTED','把你的选择连起来'],clear:['Clear','清空'],routeHeading:['What are you onto?','你发现了什么？'],routeHint:['Keep the connections that interest you. Reorder them until a direction emerges.','留下让你感兴趣的节点，调整顺序，让一个方向慢慢浮现。'],
  suggestBridge:['Suggest an existing connection','寻找已有的连接路径'],shapeIdea:['Shape this idea','整理成创意主线'],takeWithYou:['TAKE IT WITH YOU','把这条思路带走'],routeCard:['Route card','路线卡片'],projectFile:['Project','项目文件'],import:['Import','导入'],
  newExploration:['A NEW EXPLORATION','开始新的探索'],taskQuestion:['What are you trying to make?','你想完成什么？'],taskLabel:['Your task','具体任务'],seedLabel:['A starting idea, object, or event (optional)','灵感种子：一个词、事物或事件（选填）'],
  generate:['Explore possibilities','展开可能性'],connectModel:['Connect a model locally','在本地接入模型'],setupText:['Create .env from .env.example, set MODEL_BASE_URL, MODEL_API_KEY and MODEL_NAME, then restart npm start. Your key stays on your local server.','复制 .env.example 为 .env，填写 MODEL_BASE_URL、MODEL_API_KEY 和 MODEL_NAME，再运行 npm start。密钥留在你的本地服务中。'],
  suggestion:['A SUGGESTION, YOUR DECISION','系统建议，由你决定'],bridgeTitle:['A possible connection','一条可能的连接'],acceptBridge:['Keep this connection','保留这条连接'],cancel:['Cancel','取消']
};
const L = (en,zh) => lang === 'zh' ? zh : en;
const T = key => (copy[key] || [key,key])[lang === 'zh' ? 1 : 0];
const label = value => text(value,lang);
const nodeById = id => project.graph.nodes.find(n => n.id === id);
const direct = (a,b) => project.graph.edges.find(e => (e.source===a&&e.target===b)||(e.source===b&&e.target===a));
const el = (tag,className,content) => {const node=document.createElement(tag);if(className)node.className=className;if(content!==undefined)node.textContent=content;return node;};
const svgEl = (tag,attrs={}) => {const element=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))element.setAttribute(k,String(v));return element;};

function localStorageSafe(key){try{return localStorage.getItem(key);}catch{return null;}}
function fromExample(example){return validateProject({version:1,title:example.title,task:example.task,seed:example.seed,constraints:example.constraints,graph:example.graph,route:[example.graph.seedId],provenance:'curated'});}
function persist(){
  try{localStorage.setItem(STORE,JSON.stringify({project,exampleId,brief,briefSource}));localStorage.setItem('unlikely.language',lang);persistenceAvailable=true;}
  catch{persistenceAvailable=false;}
  $('save-status').textContent=persistenceAvailable?L('Saved on this device','已保存在此设备'):L('Storage unavailable · export to keep','本地保存不可用，请导出保留');
}
function restore(){
  try{const saved=JSON.parse(localStorageSafe(STORE));if(saved?.project){project=validateProject(saved.project);exampleId=EXAMPLES.some(e=>e.id===saved.exampleId)?saved.exampleId:null;selectedNode=project.graph.seedId;if(saved.brief&&['title','body','assumptions'].every(k=>typeof saved.brief[k]==='string'&&saved.brief[k].length<18000)){brief=saved.brief;briefSource=String(saved.briefSource||'').slice(0,50);}}}catch{ /* Invalid or older data never replaces a valid example. */ }
}
function notice(message){clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').hidden=false;noticeTimer=setTimeout(()=>$('notice').hidden=true,5000);}
function setTab(value){tab=value;$('explore-panel').hidden=value!=='explore';$('route-panel').hidden=value!=='route';$('tab-explore').classList.toggle('active',value==='explore');$('tab-route').classList.toggle('active',value==='route');}
function invalidateBrief(){brief=null;briefSource='';}
function setExample(id){stopTour();const example=EXAMPLES.find(e=>e.id===id);if(!example)return;exampleId=id;project=fromExample(example);selectedNode=project.graph.seedId;selectedEdge=null;invalidateBrief();setTab('explore');renderAll(true);persist();}
function updateLanguage(){
  document.documentElement.lang=lang;
  document.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=T(node.dataset.i18n));
  $('language').textContent=lang==='zh'?'EN':'中文';
  $('task-input').placeholder=L('Design a tiny ritual that makes living alone feel more like home.','为独居的人设计一个低成本、每天愿意使用的小物件。');
  $('seed-input').placeholder=L('Lemon concentrate, a train station, an unfinished letter…','柠檬浓缩液、一座车站、一封没寄出的信……');
  $('provenance').textContent=project.provenance==='curated'?L('CURATED EXAMPLE · NO LIVE AI','预设演示 · 非实时生成'):project.provenance==='model'?L('MODEL-GENERATED EXPLORATION','模型生成的探索'):L('IMPORTED EXPLORATION','导入的探索');
  $('graph-count').textContent=L(`${project.graph.nodes.length} ideas · ${project.graph.clusters.length} territories`,`${project.graph.nodes.length} 个节点 · ${project.graph.clusters.length} 个方向`);
  $('task-title').textContent=label(project.title);
  $('task-description').textContent=label(project.task);
  $('generate-task').disabled=!provider.configured;
  $('model-status').textContent=provider.configured?L(`Connected to ${provider.model}. Your task will be sent to this configured provider.`,`已连接 ${provider.model}。任务将发送至你配置的模型服务。`):L('This public demo uses curated examples. To explore a custom task, run the project locally and connect your own model.','当前使用精选预设案例。探索自己的任务，需要在本地运行项目并接入模型。');
  $('expand-status').textContent=provider.configured?L('Uses your connected model.','使用你已连接的模型。'):L('Custom expansion is available when a model is connected locally.','接入本地模型服务后，可继续生成新的分支。');
  $('expand-actions').querySelectorAll('button').forEach(button=>button.disabled=!provider.configured);
}
function renderExampleButtons(){
  $('example-switch').replaceChildren();
  EXAMPLES.forEach(example=>{
    const names={writing:L('Writing','写作'),product:L('Product','产品'),business:L('Business','商业')};
    const button=el('button',exampleId===example.id?'active':'',names[example.id]||label(example.title));button.type='button';button.setAttribute('aria-pressed',String(exampleId===example.id));button.onclick=()=>setExample(example.id);$('example-switch').append(button);
  });
  $('route-examples').replaceChildren();
  const example=EXAMPLES.find(e=>e.id===exampleId);
  (example?.curatedRoutes||[]).forEach((route,index)=>{
    const button=el('button','example-path');button.type='button';button.append(el('span','path-number',String(index+1).padStart(2,'0')),el('span','',label(route.title)));button.onclick=()=>{stopTour();project.route=[...route.nodeIds];selectedNode=route.nodeIds.at(-1);selectedEdge=null;invalidateBrief();setTab('route');renderSelection();renderRoute();persist();};$('route-examples').append(button);
  });
  document.querySelector('.route-examples').hidden=!example?.curatedRoutes?.length;
}
function computePositions(){
  positions=new Map([[project.graph.seedId,{x:700,y:20}]]);
  const centers=[[240,195],[700,195],[1160,195],[1160,480],[700,480],[240,480]];
  const offsets=[[-108,-55],[108,-55],[-108,35],[108,35],[0,125]];
  project.graph.clusters.forEach((cluster,index)=>{
    const angle=index/Math.max(project.graph.clusters.length,1)*Math.PI*2-Math.PI/2;
    const center=centers[index]||[700+480*Math.cos(angle),320+240*Math.sin(angle)];
    const members=project.graph.nodes.filter(n=>n.cluster===cluster.id&&n.kind!=='seed');
    members.forEach((node,ni)=>{let offset=offsets[ni];if(!offset){const a=(ni-5)*2.39996;const r=150+Math.floor((ni-5)/8)*45;offset=[Math.cos(a)*r,Math.sin(a)*r];}positions.set(node.id,{x:center[0]+offset[0],y:center[1]+offset[1]});});
    cluster._position=center;cluster._color=palette[index%palette.length];
  });
}
function renderGraph(){
  computePositions();nodeElements.clear();pathElements.clear();
  $('cluster-backgrounds').replaceChildren();$('cluster-labels').replaceChildren();$('edge-lines').replaceChildren();$('graph-nodes').replaceChildren();
  project.graph.clusters.forEach(cluster=>{
    const [x,y]=cluster._position;
    $('cluster-backgrounds').append(svgEl('ellipse',{cx:x,cy:y+20,rx:205,ry:112,fill:cluster._color}));
    const title=el('button','cluster-label',label(cluster.label));title.type='button';title.setAttribute('aria-label',L('Explore territory: ','探索方向：')+label(cluster.label));title.style.left=`${x}px`;title.style.top=`${y-105}px`;title.style.setProperty('--cluster-color',cluster._color);title.onclick=()=>{const first=project.graph.nodes.find(n=>n.cluster===cluster.id&&n.kind!=='seed');if(first){selectedNode=first.id;selectedEdge=null;setTab('explore');renderSelection();const rect=$('canvas').getBoundingClientRect();camera={scale:.8,x:rect.width/2-x*.8,y:rect.height/2-(y+20)*.8};applyCamera();}};$('cluster-labels').append(title);
  });
  project.graph.edges.forEach(edge=>{
    const a=positions.get(edge.source),b=positions.get(edge.target);if(!a||!b)return;
    const cx=(a.x+b.x)/2+(a.y-b.y)*.07,cy=(a.y+b.y)/2+(b.x-a.x)*.07;
    const d=`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
    const line=svgEl('path',{d,class:edge.kind});
    const hit=svgEl('path',{d,class:'edge-hit'});hit.addEventListener('click',event=>{event.stopPropagation();stopTour();selectedEdge=edge.id;selectedNode=edge.target;setTab('explore');renderSelection();});
    $('edge-lines').append(line,hit);pathElements.set(edge.id,line);
  });
  project.graph.nodes.forEach(node=>{
    const point=positions.get(node.id);if(!point)return;
    const cluster=project.graph.clusters.find(c=>c.id===node.cluster);
    const button=el('button',`node ${node.kind}`);button.type='button';button.dataset.nodeId=node.id;button.style.left=`${point.x}px`;button.style.top=`${point.y}px`;button.style.setProperty('--cluster-color',cluster?._color||palette[0]);
    button.append(el('span','node-dot'),el('span','node-label',label(node.label)));button.setAttribute('aria-label',label(node.label));
    button.addEventListener('click',event=>{event.stopPropagation();stopTour();selectedNode=node.id;selectedEdge=null;setTab('explore');renderSelection();if(innerWidth<600&&camera.scale<.6)zoomAtNode(node.id,.8);});
    $('graph-nodes').append(button);nodeElements.set(node.id,button);
  });
}
function applyCamera(){
  $('graph-world').style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;
  $('graph-world').style.setProperty('--scale',camera.scale);
  $('graph-world').classList.toggle('zoomed-out',camera.scale<.6);
  const mobileOverview=innerWidth<600&&camera.scale<.6;
  nodeElements.forEach((button,id)=>{button.tabIndex=mobileOverview&&id!==project.graph.seedId?-1:0;button.setAttribute('aria-hidden',String(mobileOverview&&id!==project.graph.seedId));});
  document.querySelector('[data-i18n="canvasHint"]').textContent=mobileOverview?L('Tap a territory to explore its ideas.','点击一个方向，放大探索其中的节点。'):T('canvasHint');
}
function fitMap(){const rect=$('canvas').getBoundingClientRect();const scale=Math.min((rect.width-40)/1400,(rect.height-48)/640,1.15);camera={scale:Math.max(.2,scale),x:(rect.width-1400*scale)/2,y:(rect.height-640*scale)/2+4};applyCamera();}
function zoom(factor,anchor){const bounds=$('canvas').getBoundingClientRect();const point=anchor||{x:bounds.width/2,y:bounds.height/2};const next=Math.max(.2,Math.min(1.75,camera.scale*factor));const ratio=next/camera.scale;camera={x:point.x-(point.x-camera.x)*ratio,y:point.y-(point.y-camera.y)*ratio,scale:next};applyCamera();}
function zoomAtNode(id,scale){const point=positions.get(id);if(!point)return;const rect=$('canvas').getBoundingClientRect();camera={scale,x:rect.width/2-point.x*scale,y:rect.height/2-point.y*scale};applyCamera();}
function renderSelection(){
  const graph=project.graph;const node=nodeById(selectedNode)||nodeById(graph.seedId);selectedNode=node.id;
  const edge=graph.edges.find(e=>e.id===selectedEdge);
  const neighbors=new Set([node.id,...graph.edges.filter(e=>e.source===node.id||e.target===node.id).flatMap(e=>[e.source,e.target])]);
  nodeElements.forEach((button,id)=>{
    const index=project.route.indexOf(id);button.classList.toggle('selected',id===node.id);button.classList.toggle('on-route',index>=0);button.classList.toggle('dimmed',node.id!==graph.seedId&&!neighbors.has(id)&&index<0);button.setAttribute('aria-pressed',String(id===node.id));
    button.querySelector('.route-badge')?.remove();if(index>=0)button.append(el('span','route-badge',String(index+1)));
  });
  const routeEdgeIds=new Set(routeEdges(graph,project.route).filter(e=>e.edge).map(e=>e.edge.id));
  pathElements.forEach((path,id)=>{const item=graph.edges.find(e=>e.id===id);const focused=id===selectedEdge||item.source===node.id||item.target===node.id;path.classList.toggle('focused',focused);path.classList.toggle('in-route',routeEdgeIds.has(id));path.classList.toggle('dimmed',node.id!==graph.seedId&&!focused&&!routeEdgeIds.has(id));});
  const cluster=graph.clusters.find(c=>c.id===node.cluster);
  $('selection-kind').textContent=edge?L('THE CONNECTION','这条连接'):node.kind==='seed'?L('YOUR STARTING POINT','你的灵感种子'):label(cluster?.label);
  $('selection-title').textContent=label(node.label);
  $('selection-description').textContent=label(node.description);
  $('relation-card').hidden=!edge;
  if(edge){$('relation-endpoints').textContent=`${label(nodeById(edge.source).label)} × ${label(nodeById(edge.target).label)}`;$('relation-reason').textContent=label(edge.reason);$('relation-kind').textContent=kindLabel(edge.kind);}
  const inRoute=project.route.includes(node.id);
  $('keep-node').disabled=inRoute;
  $('keep-node').textContent=inRoute?L('Already on your route','已在你的路线中'):L('Keep this idea','加入我的路线');
  const tail=project.route.at(-1);const hasGap=tail&&!inRoute&&!direct(tail,node.id);
  $('gap-note').hidden=!hasGap;
  $('gap-note').textContent=L('There is no direct connection from your last node yet. Keep the question open, or find a path after adding it.','它与你路线末端的节点还没有直接连接。可以先留下这个问题，再寻找中间的路径。');
  $('connected-ideas').replaceChildren();
  graph.edges.filter(e=>e.source===node.id||e.target===node.id).forEach(item=>{
    const otherId=item.source===node.id?item.target:item.source;
    const button=el('button','connected-idea');button.type='button';const content=el('span');content.append(el('strong','',label(nodeById(otherId).label)),el('small','',label(item.label)));button.append(content,el('span','link-symbol','↗'));
    button.onclick=()=>{stopTour();selectedEdge=item.id;selectedNode=otherId;renderSelection();};$('connected-ideas').append(button);
  });
  $('route-count').textContent=String(project.route.length);
}
function kindLabel(kind){return kind==='analogy'?L('Analogy · a lens, not evidence','类比 · 提供视角，不代表事实证明'):kind==='hypothesis'?L('Hypothesis · needs validation','假设 · 需要验证'):L('Association · an explained connection','关联 · 有解释的连接');}
function renderRoute(){
  const list=$('route-list');list.replaceChildren();
  if(!project.route.length)list.append(el('li','empty-route',L('Pick any node on the map, then choose “Keep this idea”.','点击地图中的任意节点，再选择“加入我的路线”。')));
  project.route.forEach((id,index)=>{
    const item=el('li','route-item');const name=el('button','text-button route-item-name',label(nodeById(id).label));name.onclick=()=>{selectedNode=id;selectedEdge=null;setTab('explore');renderSelection();};
    item.append(el('span','route-item-number',String(index+1).padStart(2,'0')),name);
    const actions=el('span','route-item-actions');
    for(const [symbol,title,delta] of [['↑',L('Move up','向前移动'),-1],['↓',L('Move down','向后移动'),1],['×',L('Remove','移除'),0]]){
      const button=el('button','',symbol);button.type='button';button.setAttribute('aria-label',`${title}: ${label(nodeById(id).label)}`);button.disabled=delta===-1&&index===0||delta===1&&index===project.route.length-1;
      button.onclick=()=>{if(delta){const next=index+delta;[project.route[index],project.route[next]]=[project.route[next],project.route[index]];}else project.route.splice(index,1);invalidateBrief();renderSelection();renderRoute();persist();};actions.append(button);
    }item.append(actions);list.append(item);
    if(index<project.route.length-1&&!direct(id,project.route[index+1]))list.append(el('li','route-gap',L('Connection still open','这一步的连接仍待探索')));
  });
  $('bridge-route').hidden=!routeEdges(project.graph,project.route).some(item=>!item.edge);
  $('synthesize').disabled=project.route.length<2;
  $('clear-route').disabled=!project.route.length;
  $('idea-brief').hidden=!brief;
  if(brief){const box=$('idea-brief');box.replaceChildren();box.append(el('div','brief-source',briefSource),el('h3','',brief.title),el('p','',brief.body));if(brief.assumptions)box.append(el('p','assumptions',brief.assumptions));}
  $('route-count').textContent=String(project.route.length);
}
function renderAll(resetCamera=false){updateLanguage();renderExampleButtons();renderGraph();renderSelection();renderRoute();setTab(tab);requestAnimationFrame(()=>resetCamera?fitMap():applyCamera());}
function keepNode(){if(project.route.includes(selectedNode))return;if(project.route.length>=40){notice(L('Keep a route to 40 ideas or fewer.','一条路线最多保留 40 个节点。'));return;}project.route.push(selectedNode);invalidateBrief();renderSelection();renderRoute();persist();notice(L('Added to your route.','已加入你的路线。'));}
function currentCuratedRoute(){const example=EXAMPLES.find(e=>e.id===exampleId);return project.provenance==='curated'?example?.curatedRoutes.find(route=>routeMatches(project.route,route.nodeIds)):null;}
async function synthesize(){
  if(project.route.length<2)return;
  const curated=currentCuratedRoute();
  if(curated){brief={title:label(curated.title),body:label(curated.output),assumptions:label(curated.assumptions)};briefSource=L('CURATED EXAMPLE OUTCOME','精选案例的预设结果');}
  else if(provider.configured){
    try{brief=await api('/api/synthesize',{project:validateProject(project),language:lang},L('Finding the thread in your choices…','正在梳理你选出的主线……'));briefSource=L('MODEL DRAFT · YOUR SELECTED ROUTE','模型草案 · 基于你的选择');}catch(error){handleError(error);return;}
  }else{
    const connections=routeEdges(project.graph,project.route);
    brief={title:L('A direction worth exploring','一条值得继续的思路'),body:project.route.map(id=>label(nodeById(id).label)).join(' → ')+'\n\n'+connections.filter(item=>item.edge).map(item=>label(item.edge.reason)).join('\n\n'),assumptions:connections.some(item=>!item.edge)?L('Some selected nodes have no direct connection yet. This is a route summary, not a generated proposal. Explore the gaps or connect a model to develop the idea.','部分节点之间尚无直接连接。这里整理的是你的探索记录；接入模型后可以进一步生成方案。'):L('This is a summary of your selected relationships, not a new AI-generated proposal. Connect a model to develop it, or try either curated path.','这是所选关系的整理，并非模型新生成的方案。接入模型可以继续发展，也可体验下方两条预设路线。')};briefSource=L('YOUR ROUTE · NO LIVE GENERATION','你的探索记录 · 非实时生成');
  }
  setTab('route');renderRoute();persist();$('idea-brief').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
}
function suggestBridge(){
  const gap=routeEdges(project.graph,project.route).find(item=>!item.edge);if(!gap)return;
  const path=findShortestPath(project.graph,gap.source,gap.target);
  if(!path||path.slice(1,-1).some(id=>project.route.includes(id))){notice(L('An existing path would repeat ideas already in your route. Try reordering your selections.','现有路径会重复已选节点，可以先调整路线顺序。'));return;}
  if(project.route.length+path.length-2>40){notice(L('This would exceed the 40-node route limit.','这会超过路线的 40 个节点上限。'));return;}
  pendingBridge={after:project.route.indexOf(gap.source),ids:path.slice(1,-1)};
  const preview=$('bridge-preview');preview.replaceChildren();preview.append(el('p','',path.map(id=>label(nodeById(id).label)).join(' → ')));
  path.slice(1).forEach((id,index)=>preview.append(el('p','',label(direct(path[index],id).reason))));
  preview.append(el('p','',L('This suggestion uses existing relationships. A short path is not automatically a good idea.','这条建议使用图中已有的关系。路径短，不代表创意一定好。')));$('bridge-dialog').showModal();
}
async function api(url,body,message){
  if(requestController)throw new Error(L('An exploration is already running.','已有探索正在进行。'));
  requestController=new AbortController();$('loading-label').textContent=message;$('loading').hidden=false;
  const timeout=setTimeout(()=>requestController?.abort(),65000);
  try{const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:requestController.signal});let result;try{result=await response.json();}catch{throw new Error(L('The model service returned an unreadable response.','模型服务返回了无法读取的内容。'));}if(!response.ok)throw new Error(typeof result.error==='string'?result.error:L('The request could not be completed.','这次请求未能完成。'));return result;}finally{clearTimeout(timeout);requestController=null;$('loading').hidden=true;}
}
function handleError(error){notice(error.name==='AbortError'?L('Stopped. Your previous map is still here.','已停止，原来的网络仍然保留。'):error.message||L('Something went wrong. Your previous map is still here.','请求未能完成，原来的网络仍然保留。'));}
async function generateTask(event){
  event.preventDefault();if(!provider.configured)return;
  const task=$('task-input').value.trim(),seed=$('seed-input').value.trim();if(!task)return;
  $('task-dialog').close();
  try{const result=await api('/api/generate',{task,seed,language:lang},L('Mapping several ways into your task…','正在从不同领域展开你的任务……'));
    const graph=validateGraph(result.graph);const seedLabel=graph.nodes.find(n=>n.id===graph.seedId).label;
    project=validateProject({version:1,title:L('Your next possibility','你的下一种可能'),task,seed:seed||seedLabel,constraints:'',graph,route:[graph.seedId],provenance:'model'});exampleId=null;selectedNode=graph.seedId;selectedEdge=null;invalidateBrief();setTab('explore');renderAll(true);persist();
  }catch(error){handleError(error);}
}
async function expand(operation){
  if(!provider.configured)return;
  try{const result=await api('/api/expand',{project:validateProject(project),nodeId:selectedNode,operation,language:lang},L('Looking beyond this idea…','正在寻找这个节点之外的可能……'));project.graph=validateGraph(result.graph);project.provenance='model';exampleId=null;invalidateBrief();renderAll(false);persist();notice(L('New possibilities added. Your route is unchanged.','新的可能性已加入，你选定的路线仍然保留。'));}catch(error){handleError(error);}
}
function download(data,type,name){const url=URL.createObjectURL(new Blob([data],{type}));const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const xml = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
function wrapText(value,max=44){const words=lang==='zh'?Array.from(value):value.split(' ');const lines=[];let line='';for(const word of words){const next=line+(line&&lang!=='zh'?' ':'')+word;if(next.length>max&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;}
function exportSVG(){
  if(!project.route.length){notice(L('Choose a route first.','先选择一条路线。'));return;}
  const gapCount=routeEdges(project.graph,project.route).filter(e=>!e.edge).length;
  const width=1000,height=290+project.route.length*96;
  const taskLines=wrapText(label(project.task),lang==='zh'?36:78).slice(0,2);
  let graphic=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#111615"/><g font-family="Avenir Next, sans-serif"><text x="64" y="67" fill="#dcf775" font-size="29" font-weight="700">unlikely.</text><text x="64" y="103" fill="#a3afa7" font-size="13" letter-spacing="2">${xml(L('ONE SEED. A PATH YOU CHOSE.','一个起点，一条由你选择的路线。'))}</text>`;
  taskLines.forEach((line,index)=>graphic+=`<text x="64" y="${148+index*29}" fill="#eef2e9" font-size="22">${xml(line)}</text>`);
  project.route.forEach((id,index)=>{const y=232+index*96;const previous=project.route[index-1];const edge=previous?direct(previous,id):null;if(index)graphic+=`<path d="M 83 ${y-70} V ${y-20}" fill="none" stroke="${edge?'#dcf775':'#bd9660'}" stroke-width="2" ${edge?'':'stroke-dasharray="4 5"'}/>`;graphic+=`<circle cx="83" cy="${y}" r="19" fill="#dcf775"/><text x="83" y="${y+5}" text-anchor="middle" fill="#111615" font-size="14">${index+1}</text><text x="122" y="${y+7}" fill="#eef2e9" font-size="27">${xml(label(nodeById(id).label))}</text>`;if(index)graphic+=`<text x="122" y="${y-31}" fill="#a3afa7" font-size="14">${xml(edge?label(edge.label):L('Connection still open','连接仍待探索'))}</text>`;});
  const origin=project.provenance==='curated'?L('Curated example · selected by you','预设案例 · 由你选路'):project.provenance==='model'?L('Model exploration · selected by you','模型探索 · 由你选路'):L('Imported exploration','导入的探索');
  graphic+=`<text x="64" y="${height-60}" fill="#a3afa7" font-size="14">${xml(origin+(gapCount?L(` · ${gapCount} open connections`,` · ${gapCount} 处待连接`):''))}</text><text x="64" y="${height-33}" fill="#a3afa7" font-size="12">${xml(REPOSITORY_URL||'Unlikely — a map of possibilities')}</text></g></svg>`;
  download(graphic,'image/svg+xml','unlikely-route.svg');
}
function importFile(file){
  if(!file)return;
  if(file.size>1_000_000){notice(L('Use a project file smaller than 1 MB.','请导入小于 1 MB 的项目文件。'));return;}
  file.text().then(raw=>{
    const restored=validateProject(JSON.parse(raw));project={...restored,provenance:'import'};exampleId=null;selectedNode=project.graph.seedId;selectedEdge=null;invalidateBrief();setTab('route');renderAll(true);persist();notice(L('Project imported.','项目已导入。'));
  }).catch(error=>notice(L('Import failed: ','导入失败：')+error.message));
}
function stopTour(){tourTimers.forEach(clearTimeout);tourTimers=[];$('tour-caption').hidden=true;}
function tourCaption(message){const box=$('tour-caption');box.replaceChildren(el('span','',message));const close=el('button','','×');close.type='button';close.setAttribute('aria-label',L('Stop tour','停止演示'));close.onclick=stopTour;box.append(close);box.hidden=false;}
function runTour(){
  stopTour();setExample('writing');
  const route=EXAMPLES.find(e=>e.id==='writing').curatedRoutes[0];
  project.route=[route.nodeIds[0]];renderSelection();renderRoute();fitMap();
  tourCaption(L('One ordinary seed. Several unexpected directions.','一个普通的起点，展开不同的可能性。'));
  const steps=route.nodeIds.slice(1);
  steps.forEach((id,index)=>tourTimers.push(setTimeout(()=>{
    selectedNode=id;selectedEdge=direct(route.nodeIds[index],id)?.id||null;project.route=route.nodeIds.slice(0,index+2);renderSelection();renderRoute();
    tourCaption(index<2?L('Follow an unexpected connection. See why it fits.','沿着意外的连接，看看它为什么成立。'):L('You choose what becomes part of the idea.','由你决定，把什么留在创意里。'));
  },3500+index*2100)));
  tourTimers.push(setTimeout(()=>{setTab('route');synthesize();tourCaption(L('A direction you can turn into something real.','把你选出的关系，整理成可以继续创作的方向。'));persist();},16500));
  tourTimers.push(setTimeout(()=>{stopTour();},21000));
}

$('language').onclick=()=>{stopTour();lang=lang==='en'?'zh':'en';if(brief){const curated=currentCuratedRoute();if(curated){brief={title:label(curated.title),body:label(curated.output),assumptions:label(curated.assumptions)};briefSource=L('CURATED EXAMPLE OUTCOME','精选案例的预设结果');}else invalidateBrief();}renderAll(false);persist();};
$('tab-explore').onclick=()=>setTab('explore');$('tab-route').onclick=()=>setTab('route');
$('keep-node').onclick=keepNode;$('synthesize').onclick=synthesize;
$('clear-route').onclick=()=>{stopTour();project.route=[];invalidateBrief();renderSelection();renderRoute();persist();};
$('bridge-route').onclick=suggestBridge;
$('accept-bridge').onclick=()=>{if(pendingBridge){project.route.splice(pendingBridge.after+1,0,...pendingBridge.ids);pendingBridge=null;invalidateBrief();renderSelection();renderRoute();persist();}$('bridge-dialog').close();};
$('new-task').onclick=()=>{stopTour();updateLanguage();$('task-dialog').showModal();};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
$('task-form').addEventListener('submit',generateTask);
document.querySelectorAll('[data-operation]').forEach(button=>button.onclick=()=>expand(button.dataset.operation));
$('cancel-request').onclick=()=>requestController?.abort();
$('export-md').onclick=()=>download(routeToMarkdown(project,lang,brief),'text/markdown;charset=utf-8','unlikely-route.md');
$('export-json').onclick=()=>download(JSON.stringify(validateProject(project),null,2),'application/json','unlikely-project.json');
$('export-svg').onclick=exportSVG;
$('import-project').onclick=()=>$('file-input').click();
$('file-input').onchange=event=>{importFile(event.target.files[0]);event.target.value='';};
$('zoom-in').onclick=()=>zoom(1.22);$('zoom-out').onclick=()=>zoom(1/1.22);$('fit-map').onclick=fitMap;
$('walkthrough').onclick=runTour;
const canvas=$('canvas');let drag=null;
canvas.addEventListener('pointerdown',event=>{if(event.target.closest('button')||event.target.closest('.edge-hit'))return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,initialX:camera.x,initialY:camera.y};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;camera.x=drag.initialX+event.clientX-drag.x;camera.y=drag.initialY+event.clientY-drag.y;applyCamera();});
canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
canvas.addEventListener('wheel',event=>{event.preventDefault();const bounds=canvas.getBoundingClientRect();zoom(Math.exp(-event.deltaY*.0015),{x:event.clientX-bounds.x,y:event.clientY-bounds.y});},{passive:false});
new ResizeObserver(()=>fitMap()).observe(canvas);
document.addEventListener('keydown',event=>{if(event.key==='Escape')stopTour();});
if(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(REPOSITORY_URL)){$('github-link').href=REPOSITORY_URL;$('github-link').hidden=false;}
restore();renderAll(true);persist();
if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') fetch('./api/status',{signal:AbortSignal.timeout(5000)}).then(response=>response.ok?response.json():null).then(status=>{if(status&&typeof status.configured==='boolean'){provider=status;updateLanguage();}}).catch(()=>{});
