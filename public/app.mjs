import { EXAMPLES } from './examples.mjs';
import { text, validateGraph, validateProject, routeEdges, findShortestPath, routeToMarkdown, routeMatches } from './core.mjs';
import { REPOSITORY_URL } from './config.mjs';
import { normalizeConnection, testConnection, requestModel } from './model-client.mjs';
import { layoutGraph } from './layout.mjs';
import { describeModelError } from './model-errors.mjs';

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
let localProvider = { configured: false, model: null };
let provider = { ...localProvider, mode: 'local' };
let browserConnection = null;
let connectionController = null;
let pendingGenerate = false;
let pendingExpansion = null;
let page = 'home';
let hasSavedProject = false;
let layout = null;
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
Object.assign(copy, {
  homeKicker:['AN OPEN WORKSPACE FOR UNEXPECTED IDEAS','一个让创意发生的开源工作台'],
  homeTitle:['One task.','一个任务，'],homeTitleAccent:['More than one way in.','不止一条思路。'],
  homeDescription:['Describe what you want to make. Explore unexpected connections, then choose a route to develop into an idea.','写下你想完成的事，发现不同事物之间的联系，再选出自己的创意主线。'],
  taskLabel:['What are you trying to make?','你想完成什么？'],
  seedLabel:['A word, object, or event to start from (optional)','已有灵感：一个词、物件或事件（选填）'],
  constraintsLabel:['Add audience or constraints (optional)','补充受众或限制（选填）'],
  presetWriting:['A short film','写一部短片'],presetProduct:['A product','设计一个产品'],presetBusiness:['A business experiment','策划商业实验'],
  nodeDetails:['Read this idea ↓','查看这个节点 ↓'],backToMap:['Back to map ↑','回到地图 ↑'],generate:['Generate my idea map','为我的任务生成联想网络'],resume:['Continue my last map ↗','继续上次的探索 ↗'],openProject:['Open a saved project','打开保存的项目'],
  exampleKicker:['GET A FEEL FOR IT','无需配置，先体验一次'],exampleTitle:['Start with something ordinary.','从一件普通的东西出发'],
  exampleDescription:['One bottle of lemon concentrate. Three very different tasks.','同一瓶柠檬浓缩液，走向三个不同的任务。'],lemonSeed:['Lemon concentrate','柠檬浓缩液'],
  writingExample:['Two siblings. Two memories of home.','两位手足，两份关于家的记忆'],writingOutcome:['A recipe becomes a story about leaving.','让一张配方，变成一个离家的故事。'],
  productExample:['Find your way back into interrupted work.','帮创作者找回被打断的思路'],productOutcome:['Compression becomes a context capsule.','从浓缩，联想到一个上下文胶囊。'],
  businessExample:['Make a quiet café worth stopping at.','让人愿意在清闲下午来咖啡店'],businessOutcome:['A small ritual becomes a service experiment.','让一个小仪式，变成可尝试的服务。'],
  exampleDisclosure:['Curated examples · No API key needed · Not live generation','预设案例 · 无需 API key · 非实时生成'],
  stepTask:['Bring a task','带着任务来'],stepTaskDetail:['What do you want to make?','写作、产品、商业，或你手头的任何任务。'],
  stepExplore:['Explore the connections','看见不同的联系'],stepExploreDetail:['See the whole map. Ask why things connect.','先看全图，再点开节点和连接理由。'],
  stepRoute:['Choose your creative route','选出自己的主线'],stepRouteDetail:['Keep ideas, connect them, and shape a draft.','留下有感觉的节点，串成思路，整理成草案。'],
  guideExplore:['01 Explore ideas & relationships','01 看节点和连接理由'],guideChoose:['02 Add ideas to your route','02 将喜欢的节点加入路线'],guideShape:['03 Shape your draft ↗','03 整理成创意主线 ↗'],
  examplesHint:['Try one of two complete routes. Then make it your own.','先试一条完整路线，再按自己的想法修改。'],
  connectionKicker:['YOUR MODEL, YOUR EXPLORATION','用自己的模型，探索自己的任务'],connectionTitle:['Connect your model','连接你的模型'],
  connectionIntro:['Use an OpenAI-compatible API. Your provider handles the generation and its usage charges.','使用兼容 OpenAI 格式的 API。生成内容与调用费用由你选择的服务商处理。'],
  baseLabel:['API base URL','API 服务地址（Base URL）'],modelLabel:['Model name','模型名称'],
  connectionPrivacy:["Your key stays in this page’s memory and clears on refresh. Requests go directly to your chosen provider with the task and relevant map content. The key is not saved or included in exports.",'密钥只保留在本页内存，刷新后清除。请求会直接向你指定的服务商发送任务和相关网络内容，密钥仅用于认证，不会保存或写入导出文件。'],
  testConnection:['Test and connect','测试并连接'],disconnect:['Disconnect and clear key','断开连接并清除密钥'],
  localAlternative:['Provider blocks browser requests?','服务商不支持浏览器直连？'],
  setupText:["Run Unlikely locally and put your provider settings in .env. The local server can reach providers that don't allow browser connections.",'可以在本地运行 Unlikely，将模型配置放入 .env。本地服务器可以连接不允许浏览器直连的服务商。'],
  localGuide:['Read the local setup guide ↗','查看本地运行方法 ↗'],
  requestHint:['Building a map can take a minute or two. Your current work stays safe until the result is ready.','生成完整网络可能需要一两分钟。结果准备好之前，你原来的探索会保留。'],newTask:['New task','新任务']
});
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
  try{const saved=JSON.parse(localStorageSafe(STORE));if(saved?.project){hasSavedProject=true;project=validateProject(saved.project);exampleId=EXAMPLES.some(e=>e.id===saved.exampleId)?saved.exampleId:null;selectedNode=project.graph.seedId;if(saved.brief&&['title','body','assumptions'].every(k=>typeof saved.brief[k]==='string'&&saved.brief[k].length<18000)){brief=saved.brief;briefSource=String(saved.briefSource||'').slice(0,50);}}}catch{ /* Invalid or older data never replaces a valid example. */ }
}
function notice(message){clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').hidden=false;noticeTimer=setTimeout(()=>$('notice').hidden=true,5000);}
function setTab(value){tab=value;$('explore-panel').hidden=value!=='explore';$('route-panel').hidden=value!=='route';$('tab-explore').classList.toggle('active',value==='explore');$('tab-route').classList.toggle('active',value==='route');}
function invalidateBrief(){brief=null;briefSource='';}
function setExample(id){stopTour();showWorkspace();const example=EXAMPLES.find(e=>e.id===id);if(!example)return;exampleId=id;project=fromExample(example);selectedNode=project.graph.seedId;selectedEdge=null;invalidateBrief();setTab('explore');renderAll(true);persist();}
function showHome(){
  if(requestController)return;stopTour();page='home';$('start-screen').hidden=false;$('workspace').hidden=true;$('resume-work').hidden=!hasSavedProject;updateLanguage();window.scrollTo({top:0,behavior:'instant'});
}
function showWorkspace(){page='workspace';$('start-screen').hidden=true;$('workspace').hidden=false;hasSavedProject=true;$('new-task').hidden=false;requestAnimationFrame(fitMap);window.scrollTo({top:0,behavior:'instant'});}
function updateProvider(){provider=browserConnection?{configured:true,model:browserConnection.model,mode:'browser'}:{...localProvider,mode:'local'};updateLanguage();}
function updateLanguage(){
  document.documentElement.lang=lang;
  document.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=T(node.dataset.i18n));
  $('language').textContent=lang==='zh'?'EN':'中文';
  $('task-input').placeholder=L('Write a short film about leaving home, with two actors and one kitchen.','例如：写一部关于离家的短片，只有两位演员和一间厨房。');
  $('seed-input').placeholder=L('Lemon concentrate, a train station, an unfinished letter…','柠檬浓缩液、一座车站、一封没寄出的信……');
  $('constraints-input').placeholder=L('Who is it for? Time, budget, format, or things to avoid…','给谁看？时长、预算、呈现形式，或需要避开的方向……');
  $('constraints-input').setAttribute('aria-label',L('Audience and constraints','受众与限制'));
  $('provenance').textContent=project.provenance==='curated'?L('CURATED EXAMPLE · NO LIVE AI','预设演示 · 非实时生成'):project.provenance==='model'?L('MODEL-GENERATED EXPLORATION','模型生成的探索'):L('IMPORTED EXPLORATION','导入的探索');
  $('graph-count').textContent=L(`${project.graph.nodes.length} ideas · ${project.graph.clusters.length} territories`,`${project.graph.nodes.length} 个节点 · ${project.graph.clusters.length} 个方向`);
  $('task-title').textContent=label(project.title);$('task-description').textContent=label(project.task);$('task-description').hidden=label(project.title)===label(project.task);
  $('task-constraints').textContent=label(project.constraints);$('task-constraints').hidden=!label(project.constraints);
  $('new-task').hidden=page==='home';$('resume-work').hidden=!hasSavedProject;
  $('connection-label').textContent=provider.configured?L('Model connected','模型已连接'):L('Connect a model','连接模型');
  $('connection-button').classList.toggle('connected',provider.configured);
  $('connection-button').title=provider.configured?provider.model:T('connectionTitle');
  $('model-status').textContent=provider.configured?L(`Uses ${provider.model}. Your task goes to your configured provider.`,`使用 ${provider.model}，任务将发送到你配置的模型服务。`):L('Connect your model to generate a new map, or try a ready-made example.','生成自己的网络需要连接模型；也可以先体验下面的完整案例。');
  $('expand-status').textContent=provider.configured?L('Generate new branches with your connected model.','使用已连接的模型生成新的分支。'):L('Connect a model to generate new branches.','连接模型后，可以生成新的分支。');
  $('expand-actions').querySelectorAll('button').forEach(button=>button.disabled=false);
  $('test-connection').textContent=connectionController?L('Testing the connection…','正在测试连接……'):pendingGenerate?L('Connect and generate my map','连接并开始生成'):pendingExpansion?L('Connect and expand this idea','连接并继续拓展'):T('testConnection');
  $('active-connection').hidden=!provider.configured;
  $('active-connection').textContent=provider.configured?L(`Active: ${provider.model}${provider.mode==='local'?' · local server':''}`,`当前：${provider.model}${provider.mode==='local'?' · 本地服务器':''}`):'';
  $('disconnect-model').hidden=!browserConnection;
  updateDestination();
}
function updateDestination(){
  let destination='';try{const url=new URL($('model-base').value);destination=url.origin+url.pathname;}catch{}
  $('connection-destination').textContent=destination?L(`Send the key and one test request to: ${destination}`,`将向此地址发送密钥和一次模型测试请求：${destination}`):L('Enter your own provider’s API address. The test makes one model request; reasoning tokens may also be billed.','请填写你自己的模型服务地址。测试会发起一次模型请求，思考过程也可能计费。');
}
function openConnection(forGeneration=false,operation=null){
  stopTour();pendingGenerate=forGeneration;pendingExpansion=operation;$('connection-error').hidden=true;$('model-key').value='';
  if(browserConnection){$('model-base').value=browserConnection.baseUrl;$('model-name').value=browserConnection.model;}
  updateLanguage();$('connection-dialog').showModal();
}
function connectionError(error){return describeModelError(error,lang);}
async function connectModel(event){
  event.preventDefault();if(connectionController)return;
  let candidate;try{candidate=normalizeConnection({baseUrl:$('model-base').value.trim(),model:$('model-name').value.trim(),apiKey:$('model-key').value.trim()});}catch(error){$('connection-error').textContent=connectionError(error);$('connection-error').hidden=false;return;}
  const controller=new AbortController();connectionController=controller;$('test-connection').disabled=true;$('connection-error').hidden=true;updateLanguage();
  try{
    await testConnection(candidate,{signal:controller.signal});if(controller.signal.aborted)return;
    browserConnection=candidate;$('model-key').value='';const generateNext=pendingGenerate,expandNext=pendingExpansion;pendingGenerate=false;pendingExpansion=null;$('connection-dialog').close();updateProvider();
    notice(L('Model connected for this page session.','模型已连接，仅在本次页面会话中保留。'));
    if(generateNext)await generateTask();else if(expandNext)await expand(expandNext);
  }catch(error){if(!controller.signal.aborted){$('connection-error').textContent=connectionError(error);$('connection-error').hidden=false;}}
  finally{if(connectionController===controller)connectionController=null;$('test-connection').disabled=false;updateLanguage();}
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
  layout=layoutGraph(project.graph);
  const viewport=$('canvas').getBoundingClientRect();
  const stretch=viewport.width>650?Math.max(1,((viewport.width-44)/Math.max(1,viewport.height-72))/(layout.width/layout.height)):1;
  if(stretch>1){layout.width*=stretch;layout.positions.forEach(point=>{point.x*=stretch;});layout.clusters.forEach(region=>{region.x*=stretch;region.width*=stretch;});}
  positions=layout.positions;
  $('graph-world').style.width=`${layout.width}px`;$('graph-world').style.height=`${layout.height}px`;
  $('graph-svg').setAttribute('viewBox',`0 0 ${layout.width} ${layout.height}`);$('graph-svg').style.width=`${layout.width}px`;$('graph-svg').style.height=`${layout.height}px`;
  project.graph.clusters.forEach((cluster,index)=>{const region=layout.clusters.get(cluster.id);cluster._position=[region.x,region.y];cluster._region=region;cluster._color=palette[index%palette.length];});
}
function renderGraph(){
  computePositions();nodeElements.clear();pathElements.clear();
  $('cluster-backgrounds').replaceChildren();$('cluster-labels').replaceChildren();$('edge-lines').replaceChildren();$('graph-nodes').replaceChildren();
  project.graph.clusters.forEach(cluster=>{
    const [x,y]=cluster._position;
    $('cluster-backgrounds').append(svgEl('ellipse',{cx:x,cy:y,rx:cluster._region.width/2,ry:cluster._region.height/2,fill:cluster._color}));
    const title=el('button','cluster-label',label(cluster.label));title.type='button';title.setAttribute('aria-label',L('Explore territory: ','探索方向：')+label(cluster.label));title.style.left=`${x}px`;title.style.top=`${y-cluster._region.height/2+16}px`;title.style.setProperty('--cluster-color',cluster._color);title.onclick=()=>{const first=project.graph.nodes.find(n=>n.cluster===cluster.id&&n.kind!=='seed');if(first){selectedNode=first.id;selectedEdge=null;setTab('explore');renderSelection();const rect=$('canvas').getBoundingClientRect();camera={scale:.8,x:rect.width/2-x*.8,y:rect.height/2-(y+20)*.8};applyCamera();}};$('cluster-labels').append(title);
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
  const mobileOverview=(innerWidth<600&&camera.scale<.6)||camera.scale<.27;
  $('graph-world').classList.toggle('compact-overview',mobileOverview);
  nodeElements.forEach((button,id)=>{button.tabIndex=mobileOverview&&id!==project.graph.seedId?-1:0;button.setAttribute('aria-hidden',String(mobileOverview&&id!==project.graph.seedId));});
  document.querySelector('[data-i18n="canvasHint"]').textContent=mobileOverview?L('Tap a territory to explore its ideas.','点击一个方向，放大探索其中的节点。'):T('canvasHint');
}
function fitMap(){if(!layout||page==='home')return;const rect=$('canvas').getBoundingClientRect();if(!rect.width)return;const scale=Math.min((rect.width-44)/layout.width,(rect.height-72)/layout.height,1.15);camera={scale:Math.max(.06,scale),x:(rect.width-layout.width*scale)/2,y:58+(rect.height-72-layout.height*scale)/2};applyCamera();}
function zoom(factor,anchor){const bounds=$('canvas').getBoundingClientRect();const point=anchor||{x:bounds.width/2,y:bounds.height/2};const next=Math.max(.06,Math.min(1.75,camera.scale*factor));const ratio=next/camera.scale;camera={x:point.x-(point.x-camera.x)*ratio,y:point.y-(point.y-camera.y)*ratio,scale:next};applyCamera();}
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
    const item=el('li','route-item');const name=el('button','text-button route-item-name',label(nodeById(id).label));name.onclick=()=>{stopTour();selectedNode=id;selectedEdge=null;setTab('explore');renderSelection();};
    item.append(el('span','route-item-number',String(index+1).padStart(2,'0')),name);
    const actions=el('span','route-item-actions');
    for(const [symbol,title,delta] of [['↑',L('Move up','向前移动'),-1],['↓',L('Move down','向后移动'),1],['×',L('Remove','移除'),0]]){
      const button=el('button','',symbol);button.type='button';button.setAttribute('aria-label',`${title}: ${label(nodeById(id).label)}`);button.disabled=delta===-1&&index===0||delta===1&&index===project.route.length-1;
      button.onclick=()=>{stopTour();if(delta){const next=index+delta;[project.route[index],project.route[next]]=[project.route[next],project.route[index]];}else project.route.splice(index,1);invalidateBrief();renderSelection();renderRoute();persist();};actions.append(button);
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
function keepNode(){stopTour();if(project.route.includes(selectedNode))return;if(project.route.length>=40){notice(L('Keep a route to 40 ideas or fewer.','一条路线最多保留 40 个节点。'));return;}project.route.push(selectedNode);invalidateBrief();renderSelection();renderRoute();persist();notice(L('Added. Open “My route” to arrange your ideas.','已加入。打开“我的路线”，可以调整顺序、整理主线。'));}
function currentCuratedRoute(){const example=EXAMPLES.find(e=>e.id===exampleId);return project.provenance==='curated'?example?.curatedRoutes.find(route=>routeMatches(project.route,route.nodeIds)):null;}
async function synthesize(){
  stopTour();if(project.route.length<2)return;
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
  stopTour();const gap=routeEdges(project.graph,project.route).find(item=>!item.edge);if(!gap)return;
  const path=findShortestPath(project.graph,gap.source,gap.target);
  if(!path||path.slice(1,-1).some(id=>project.route.includes(id))){notice(L('An existing path would repeat ideas already in your route. Try reordering your selections.','现有路径会重复已选节点，可以先调整路线顺序。'));return;}
  if(project.route.length+path.length-2>40){notice(L('This would exceed the 40-node route limit.','这会超过路线的 40 个节点上限。'));return;}
  pendingBridge={after:project.route.indexOf(gap.source),ids:path.slice(1,-1)};
  const preview=$('bridge-preview');preview.replaceChildren();preview.append(el('p','',path.map(id=>label(nodeById(id).label)).join(' → ')));
  path.slice(1).forEach((id,index)=>preview.append(el('p','',label(direct(path[index],id).reason))));
  preview.append(el('p','',L('This suggestion uses existing relationships. A short path is not automatically a good idea.','这条建议使用图中已有的关系。路径短，不代表创意一定好。')));$('bridge-dialog').showModal();
}
async function api(url,body,message){
  stopTour();if(requestController)throw Object.assign(new Error('Busy'),{code:'INPUT'});
  const controller=new AbortController();requestController=controller;let timedOut=false;
  $('loading-label').textContent=message;$('request-time').textContent='';$('request-dialog').showModal();
  const started=Date.now();const ticker=setInterval(()=>{$('request-time').textContent=L(`${Math.floor((Date.now()-started)/1000)} seconds elapsed`,`${Math.floor((Date.now()-started)/1000)} 秒`);},1000);
  const timeout=setTimeout(()=>{timedOut=true;controller.abort();},125000);
  try{
    let result;
    if(browserConnection){result=await requestModel(url.split('/').at(-1),body,browserConnection,{signal:controller.signal});}
    else{
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      try{result=await response.json();}catch(error){if(controller.signal.aborted||error.name==='AbortError')throw Object.assign(new Error('Stopped'),{code:'ABORTED'});throw Object.assign(new Error('Invalid response'),{code:'INVALID_RESPONSE'});}
      if(!response.ok)throw Object.assign(new Error('Provider request failed'),{code:result.code||'PROVIDER',httpStatus:result.httpStatus,providerDetails:result.providerDetails});
    }
    if(controller.signal.aborted)throw Object.assign(new Error('Stopped'),{code:'ABORTED'});return result;
  }catch(error){if(timedOut)throw Object.assign(new Error('Timeout'),{code:'TIMEOUT'});throw error;}
  finally{clearTimeout(timeout);clearInterval(ticker);if(requestController===controller)requestController=null;$('request-dialog').close();}
}
function handleError(error){const message=connectionError(error);notice(message);if(page==='home'){$('task-error').textContent=message;$('task-error').hidden=false;}}
async function generateTask(event){
  event?.preventDefault();if(requestController)return;
  const task=$('task-input').value.trim(),seed=$('seed-input').value.trim(),constraints=$('constraints-input').value.trim();if(!task){$('task-input').focus();return;}
  $('task-error').hidden=true;
  if(!provider.configured){openConnection(true);return;}
  try{
    const result=await api('/api/generate',{task,seed,constraints,language:lang},L('Finding different ways into your task…','正在为你的任务展开不同的可能性……'));
    const graph=validateGraph(result.graph);const seedLabel=graph.nodes.find(n=>n.id===graph.seedId).label;
    project=validateProject({version:1,title:task.slice(0,90),task,seed:seed||seedLabel,constraints,graph,route:[graph.seedId],provenance:'model'});exampleId=null;selectedNode=graph.seedId;selectedEdge=null;invalidateBrief();showWorkspace();setTab('explore');renderAll(true);persist();
    notice(L('Your map is ready. Choose a node to see what it could lead to.','你的地图已展开。点开一个节点，看看它能带你走向哪里。'));
  }catch(error){handleError(error);}
}
async function expand(operation){
  stopTour();if(!provider.configured){openConnection(false,operation);return;}
  try{const result=await api('/api/expand',{project:validateProject(project),nodeId:selectedNode,operation,language:lang},L('Looking beyond this idea…','正在寻找这个节点之外的可能……'));project.graph=validateGraph(result.graph);project.provenance='model';exampleId=null;invalidateBrief();renderAll(true);persist();notice(L('New possibilities added. Your route is unchanged.','新的可能性已加入，你选定的路线仍然保留。'));}catch(error){handleError(error);}
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
  if(!file)return;stopTour();
  if(file.size>1_000_000){notice(L('Use a project file smaller than 1 MB.','请导入小于 1 MB 的项目文件。'));return;}
  file.text().then(raw=>{
    const restored=validateProject(JSON.parse(raw));project={...restored,provenance:'import'};exampleId=null;selectedNode=project.graph.seedId;selectedEdge=null;invalidateBrief();showWorkspace();setTab('route');renderAll(true);persist();notice(L('Project imported.','项目已导入。'));
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
  tourTimers.push(setTimeout(()=>{
    const curated=currentCuratedRoute();if(!curated){stopTour();return;}
    // A tour always displays authored content, even when a model is connected.
    brief={title:label(curated.title),body:label(curated.output),assumptions:label(curated.assumptions)};
    briefSource=L('CURATED EXAMPLE OUTCOME','精选案例的预设结果');setTab('route');renderRoute();persist();
    $('idea-brief').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
    tourCaption(L('A direction you can turn into something real.','把你选出的关系，整理成可以继续创作的方向。'));
  },16500));
  tourTimers.push(setTimeout(()=>{stopTour();},21000));
}

$('language').onclick=()=>{stopTour();lang=lang==='en'?'zh':'en';if(brief){const curated=currentCuratedRoute();if(curated){brief={title:label(curated.title),body:label(curated.output),assumptions:label(curated.assumptions)};briefSource=L('CURATED EXAMPLE OUTCOME','精选案例的预设结果');}else invalidateBrief();}renderAll(false);persist();};
$('tab-explore').onclick=()=>setTab('explore');$('tab-route').onclick=()=>setTab('route');
$('keep-node').onclick=keepNode;$('synthesize').onclick=synthesize;
$('clear-route').onclick=()=>{stopTour();project.route=[];invalidateBrief();renderSelection();renderRoute();persist();};
$('bridge-route').onclick=suggestBridge;
$('accept-bridge').onclick=()=>{stopTour();if(pendingBridge){project.route.splice(pendingBridge.after+1,0,...pendingBridge.ids);pendingBridge=null;invalidateBrief();renderSelection();renderRoute();persist();}$('bridge-dialog').close();};
$('new-task').onclick=showHome;
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
$('task-form').addEventListener('submit',generateTask);
$('home-link').onclick=event=>{event.preventDefault();showHome();};
$('resume-work').onclick=()=>{showWorkspace();renderAll(true);};
$('home-import').onclick=()=>$('file-input').click();
$('mobile-details').onclick=()=>{setTab('explore');$('tab-explore').scrollIntoView({behavior:'smooth',block:'start'});};
$('back-to-map').onclick=()=>$('canvas').scrollIntoView({behavior:'smooth',block:'start'});
$('guide-route').onclick=()=>{setTab('route');if(innerWidth<=900)$('tab-route').scrollIntoView({behavior:'smooth',block:'start'});};
$('connection-button').onclick=()=>openConnection();
$('connection-form').addEventListener('submit',connectModel);
$('model-base').addEventListener('input',updateDestination);
$('connection-dialog').addEventListener('close',()=>{connectionController?.abort();$('model-key').value='';pendingGenerate=false;pendingExpansion=null;});
$('disconnect-model').onclick=()=>{connectionController?.abort();browserConnection=null;$('model-key').value='';$('connection-dialog').close();updateProvider();notice(L('Browser connection cleared.','网页模型连接已清除。'));};
$('request-dialog').addEventListener('cancel',event=>{event.preventDefault();requestController?.abort();});
document.querySelectorAll('[data-open-example]').forEach(button=>button.onclick=()=>setExample(button.dataset.openExample));
document.querySelectorAll('[data-task-preset]').forEach(button=>button.onclick=()=>{const example=EXAMPLES.find(item=>item.id===button.dataset.taskPreset);if(example){$('task-input').value=label(example.task);$('seed-input').value=label(example.seed);$('constraints-input').value=label(example.constraints);$('task-input').focus();}});

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
new ResizeObserver(()=>{if(page==='workspace'){renderGraph();renderSelection();fitMap();}}).observe(canvas);
document.addEventListener('keydown',event=>{if(event.key==='Escape')stopTour();});
if(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(REPOSITORY_URL)){$('github-link').href=REPOSITORY_URL;$('github-link').hidden=false;}
restore();renderAll(true);showHome();
if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') fetch('./api/status',{signal:AbortSignal.timeout(5000)}).then(response=>response.ok?response.json():null).then(status=>{if(status&&typeof status.configured==='boolean'){localProvider=status;updateProvider();}}).catch(()=>{});
