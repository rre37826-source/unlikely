// Curated creative examples, not externally verified research or live AI output.
// A relation marked "analogy" is a creative comparison, not a factual equivalence.
// Six clusters contain five non-seed nodes each; the seed is an extra node.

const t = (en, zh) => ({ en, zh });
const node = (id, cluster, label, description, kind = 'concept') => ({
  id, cluster, label, description, kind,
});
const edge = (source, target, label, reason, kind = 'analogy') => ({
  id: `${source}--${target}`, source, target, label, reason, kind,
});

const CLUSTERS = [
  { id: 'reduction', label: t('What remains', '留下了什么') },
  { id: 'signal', label: t('Signals & context', '信号与上下文') },
  { id: 'ritual', label: t('Rituals & belonging', '仪式与归属') },
  { id: 'sound', label: t('Rhythm & variation', '节奏与变奏') },
  { id: 'play', label: t('Rules & possibilities', '规则与可能性') },
  { id: 'city', label: t('Places & thresholds', '地点与门槛') },
];

const CONCEPTS = [
  node('water', 'reduction', t('Remove the water', '把水拿走'), t(
    'Concentrating juice commonly removes some water. Use the change in volume as a creative starting point, not a claim about a particular product.',
    '果汁浓缩通常会去除部分水分。这里借用体积改变这一过程，不指代某个品牌的具体配方。')),
  node('remainder', 'reduction', t('What survives?', '什么被留下？'), t(
    'A creative question: when something is reduced, which qualities do we choose to preserve, and which absences become noticeable?',
    '一个创作问题：当东西被缩减，我们选择保留哪些特征，又会开始察觉哪些缺席？')),
  node('bottle', 'reduction', t('A small container', '一个小容器'), t(
    'A small bottle suggests portability and a visible limit. The metaphor is a compact container for something that can later grow.',
    '小瓶让人想到便携和可见的容量限制。这里把它比作一个装下某种可继续展开之物的容器。')),
  node('water_back', 'reduction', t('Add something back', '把什么加回来'), t(
    'Dilution changes concentration. As a metaphor, ask what must be supplied to make a compact thing useful; it does not imply perfect restoration of flavor.',
    '稀释会改变浓度。作为隐喻，可以追问：紧凑的东西需要补入什么才有用？这不意味着风味能被完美还原。')),

  node('compression', 'signal', t('Data compression', '数据压缩'), t(
    'Compression reduces a representation’s size. Lossless and lossy methods preserve different things; a short human summary is not automatically lossless.',
    '压缩会缩小数据表示的体积。无损和有损方式保留的内容不同；一段简短的人类总结并不自动等于无损压缩。')),
  node('omission', 'signal', t('The omitted detail', '被略去的细节'), t(
    'Lossy representations discard information. In a human account, an omitted detail can change the meaning; this is a comparison, not the same mechanism.',
    '有损表示会舍弃信息。人的讲述中，一个被略去的细节也可能改变意思；二者可以对照，但机制并不相同。')),
  node('context', 'signal', t('The missing context', '缺失的上下文'), t(
    'A message can be clear to its author and obscure to someone else. Ask which shared context the recipient is expected to supply.',
    '一句话可能对作者很清楚，对别人却难以理解。可以追问：接收者被默认需要自行补上哪些共同背景？')),
  node('reconstruction', 'signal', t('More than one reading', '不止一种读法'), t(
    'People can interpret an incomplete account differently. Explore competing readings instead of treating the first interpretation as established fact.',
    '面对不完整的讲述，人可能形成不同理解。把几种读法展开，而不是把第一种理解当成已经确定的事实。')),

  node('recipe', 'ritual', t('A shared recipe', '共同的配方'), t(
    'A recipe makes a process repeatable, while its use may involve preferences, habits, and knowledge that were never written down.',
    '配方让过程可以重复，而实际使用还可能包含未被写下的偏好、习惯和经验。')),
  node('gesture', 'ritual', t('A repeated gesture', '重复的小动作'), t(
    'Pouring, stirring, or passing a glass can become a chosen cue for starting, returning, or acknowledging another person.',
    '倒水、搅拌、递杯子，可以被设计成开始、重新进入或回应另一个人的提示动作。')),
  node('private_code', 'ritual', t('An inside reference', '只有彼此懂的暗号'), t(
    'A phrase or action can acquire a special meaning within a relationship. This is a storytelling possibility, not a universal rule about groups.',
    '一句话或一个动作，可以在某段关系中形成特殊含义。这是一种叙事可能，不是关于所有群体的普遍规律。')),
  node('welcome', 'ritual', t('An invitation', '一个邀请'), t(
    'An offered glass can stage an invitation. The recipient may accept, change, or decline it: belonging still involves a choice.',
    '递出一杯饮料可以构成一个邀请。对方可以接受、修改或拒绝；进入关系仍然包含选择。')),

  node('motif', 'sound', t('Music: a recurring motif', '音乐：反复出现的动机'), t(
    'Keep a short musical idea recognizable while varying its rhythm or reply. Borrow this pattern to compare versions of one intention, action, or experience.',
    '让一小段音乐材料保持可辨认，同时改变节奏或回应。把这种结构借给一个意图、动作或体验，让不同版本可以被比较。')),
  node('rest', 'sound', t('Music: a deliberate rest', '音乐：一次有意的休止'), t(
    'Place a pause before the next response. As a creative analogy, timing can change what a repeated gesture invites; the other person still chooses how to respond.',
    '在下一次回应之前安排停顿。作为创意类比，时机可以改变同一个动作发出的邀请；如何回应仍由对方选择。')),
  node('variation', 'sound', t('Variation, not replacement', '变奏，保留辨识度'), t(
    'Change one feature while keeping a recognizable idea. Ask what should stay stable so that alternatives can still be compared.',
    '改变一个特征，同时保留可辨认的原始材料。追问什么需要稳定，才能让不同版本仍然可以比较。')),
  node('call_response', 'sound', t('Music: call and response', '音乐：发问与回应'), t(
    'One musical phrase invites another to answer. Borrow the exchange: hold the initial cue steady, then change who responds, when, or with what action.',
    '一个乐句邀请另一个乐句回答。借用这种交换结构：保留最初的提示，再改变谁来回应、何时回应，或用什么动作回应。')),

  node('inventory', 'play', t('A limited inventory', '有限的道具栏'), t(
    'Games can make available resources visible. A limited set of objects or choices can become material for invention rather than merely a shortage.',
    '游戏可以把可用资源清楚地摆出来。有限的物件或选项，既是一种限制，也可以成为发明新用法的材料。')),
  node('rule', 'play', t('One simple rule', '一条简单规则'), t(
    'An explicit rule defines what a player may do. A creative exercise can change one rule and explore what choices that change opens.',
    '明确的规则限定玩家可以做什么。创作练习可以改变其中一条，看看会因此出现哪些选择。')),
  node('unlock', 'play', t('A new possibility', '打开一种可能'), t(
    'A game may reveal a new action after a condition is met. In a creative task, consider what changes when a person gains access or permission.',
    '游戏可能在满足条件后开放新动作。移到创作中，可以考察：一个人获得入口或许可后，局面会怎样改变？')),
  node('replay', 'play', t('Game: reload and choose', '游戏：读档后重选'), t(
    'Some games let players return to a saved state and choose again. Borrow this structure to compare decisions from a recognizable starting point; real actions need not be reversible.',
    '一些游戏允许玩家返回存档，重新选择。借用这种结构，从可辨认的起点比较不同决定；现实中的行动并不因此可以撤销。')),

  node('threshold', 'city', t('A threshold', '一道门槛'), t(
    'An entrance marks a transition between places. As a metaphor, it can help design a clear moment of arrival, return, or departure.',
    '入口标记着地点之间的转换。作为隐喻，它可以帮助设计一个清楚的抵达、返回或离开时刻。')),
  node('sign', 'city', t('A wayfinding sign', '一块路标'), t(
    'A sign relates a person’s position to a destination. Ask what information someone needs here, rather than showing every possible direction.',
    '路标把人所在的位置与目的地联系起来。可以追问：这个位置上的人需要什么信息，而不必把所有方向都写上。')),
  node('meeting', 'city', t('A meeting point', '一个碰面点'), t(
    'A named place can coordinate a meeting. Its value in this example is a shared point of reference, not a claim that a location creates community.',
    '一个被明确命名的地点可以帮助人约定见面。这里看重的是共同参照，不假定某个地点必然会产生社群。')),
  node('detour', 'city', t('A small detour', '一段小绕路'), t(
    'A route can include an optional stop. Design the stop so people understand what it offers and remain free to continue past it.',
    '一条路线可以容纳一个可选的停靠点。把它提供什么说清楚，同时让人保留直接经过的自由。')),
];

const COMMON_EDGES = [
  edge('seed', 'water', t('concentrating', '浓缩过程'), t('The seed evokes the removal of some water during concentration.', '种子让人联想到浓缩过程中去除部分水分的操作。'), 'association'),
  edge('seed', 'recipe', t('needs a proportion', '需要比例'), t('Mixing concentrate with water raises a practical question about proportions and preferences.', '把浓缩液与水混合，会遇到比例和口味偏好的实际问题。'), 'association'),
  edge('seed', 'motif', t('same core, different variations', '同一份核心，不同变奏'), t('One concentrate can be mixed at different ratios; one motif can receive different treatments. Borrow the pattern of a recognizable core with changing variations, not a shared physical mechanism.', '同一份浓缩液可以调出不同比例，同一个音乐动机可以有不同处理。借用的是“保留可辨认的核心，再改变处理方式”的结构，不是相同的物理机制。')),
  edge('seed', 'bottle', t('a pocket-sized starting point', '装进口袋的起点'), t('Imagine a small bottle as a portable starting point for a larger experience.', '把小瓶想象成一个可以携带、随后展开为更大体验的起点。')),

  edge('water', 'remainder', t('notice what stays', '注意留下的部分'), t('Removing something prompts the creative question of what remains noticeable.', '拿走一部分东西，会引出“什么仍然明显”的创作问题。')),
  edge('remainder', 'bottle', t('give the remainder a form', '给留下之物一个形状'), t('A container can make an abstract question about preservation visible and tangible.', '容器可以把“保留什么”的抽象问题变成可见、可拿取的东西。')),
  edge('bottle', 'water_back', t('expand at the destination', '在目的地展开'), t('A concentrate can be diluted when used; the small container need not be the final serving.', '浓缩液可以在使用时稀释，小容器中的状态不必就是最终饮用状态。'), 'association'),

  edge('compression', 'omission', t('lossy or lossless?', '有损还是无损？'), t('Lossy compression discards some information; lossless compression does not. The distinction asks us to name what a human summary leaves out.', '有损压缩会舍弃部分信息，无损压缩则不会。借这个区别，可以明确人的总结略去了什么。'), 'association'),
  edge('omission', 'context', t('what must the reader supply?', '读者需要自行补什么？'), t('In communication, a missing detail may require background knowledge. This is an analogy, not a description of a compression algorithm.', '在交流中，缺失细节可能需要背景知识补足。这是类比，不是在描述某种压缩算法。')),
  edge('context', 'reconstruction', t('changes the reading', '改变读法'), t('Different available context can support different interpretations of an incomplete account.', '可用背景不同，可能使同一段不完整的讲述产生不同理解。'), 'association'),

  edge('recipe', 'gesture', t('instructions become actions', '说明变成动作'), t('Following a recipe turns written proportions into repeated physical actions.', '按配方操作，会把写下的比例变成可重复的实际动作。'), 'association'),
  edge('gesture', 'private_code', t('a gesture acquires a meaning', '动作获得特殊含义'), t('A repeated gesture can be written as a shared reference between particular characters or participants.', '可以把重复动作设计成某些角色或参与者之间的共同暗号。')),
  edge('private_code', 'welcome', t('share the meaning', '把含义分享出去'), t('An inside reference can become an invitation when someone chooses to explain it.', '当一个人愿意解释时，内部暗号也可以变成邀请别人加入的方式。')),

  edge('motif', 'rest', t('keep the phrase, move the pause', '保留乐句，改变停顿'), t('Hold the repeated phrase steady and vary the pause before its reply. Timing becomes a variable to explore in a scene, interaction, or recurring service.', '保留反复出现的乐句，改变回应前的停顿。这样，时机就成为场景、交互或周期性服务中可以尝试改变的变量。')),
  edge('rest', 'variation', t('change the timing', '改变出现的时机'), t('Varying the placement of a pause is one possible way to alter how a repeated phrase is experienced.', '改变停顿的位置，是改变重复材料呈现效果的一种创作办法。')),
  edge('variation', 'call_response', t('a variation can answer', '变化也可以构成回答'), t('An altered repetition can be designed as a response to what came before.', '一次发生改变的重复，可以被设计成对前一次的回应。')),

  edge('inventory', 'rule', t('decide what can be done', '规定这些东西能做什么'), t('In a game, rules determine how the available objects or resources can be used.', '在游戏中，规则规定可用物件或资源如何使用。'), 'association'),
  edge('rule', 'unlock', t('make access explicit', '把开放条件说清楚'), t('A game rule may specify when a new action becomes available.', '一条游戏规则可以明确某个新动作何时开放。'), 'association'),
  edge('unlock', 'replay', t('try the changed possibilities', '重新试试新的可能'), t('A newly available choice could motivate a return to an earlier situation. This is a design possibility, not a universal player behavior.', '新开放的选择，可以成为返回先前局面的理由。这是一种设计可能，不是对所有玩家行为的判断。'), 'hypothesis'),

  edge('threshold', 'sign', t('make arrival legible', '让抵达变得明确'), t('An entrance and a sign can work together to tell someone where they are and what is available.', '入口与路标可以配合，让人知道自己到了哪里、这里提供什么。'), 'association'),
  edge('sign', 'meeting', t('name a common destination', '命名共同的目的地'), t('Naming and indicating a meeting point makes it easier to refer to the same place.', '给碰面点命名并标示位置，有助于人们指向同一个地点。'), 'association'),
  edge('meeting', 'detour', t('become an optional stop', '成为可选的停靠点'), t('Imagine a meeting point as a small, voluntary addition to an existing route.', '把碰面点想象成原有路线中一个小小的、自愿加入的停靠点。')),

  edge('water', 'compression', t('smaller representation', '更小的表示'), t('Concentrating juice and compressing data operate differently. Compare the question they raise: what can shrink while a useful core remains?', '果汁浓缩与数据压缩的机制不同。可以比较它们共同引出的一个问题：什么可以缩小，而仍保留有用的核心？')),
  edge('remainder', 'omission', t('preservation has a reverse side', '保留的背面是省略'), t('Looking at what is kept also invites inspection of what was excluded.', '审视保留了什么，也会邀请我们检查哪些东西被排除。')),
  edge('bottle', 'inventory', t('make the limit visible', '让有限变得可见'), t('A small container and a limited game inventory both offer a visible boundary to design around.', '小容器与有限的游戏道具栏，都可以提供一个明确可见、可据此展开设计的边界。')),
  edge('water_back', 'context', t('supply what is missing', '补入缺少的部分'), t('Adding water and adding context are not equivalent; the analogy asks what a recipient must contribute before something becomes usable.', '加水和补背景并不等价；这个类比用来追问：接收者还需要加入什么，才能真正使用手中的东西？')),
  edge('omission', 'recipe', t('the unwritten ingredient', '没有写下的配料'), t('A recipe can stand in for an incomplete record whose users supply different unwritten knowledge.', '可以把配方当作不完整记录的具体形式，不同使用者会为它补入不同的未写经验。')),
  edge('context', 'gesture', t('put context into a cue', '把背景放进提示动作'), t('A designed return gesture could cue someone to review the relevant context at the moment it is needed.', '一个被设计的返回动作，可以提示人恰好在需要时重新查看相关背景。')),
  edge('recipe', 'motif', t('repeat with a difference', '带着变化重复'), t('A familiar recipe and a musical motif can both serve as starting material for recognizable variations.', '熟悉的配方与音乐动机，都可以作为仍有辨识度的不同版本的起始材料。')),
  edge('private_code', 'call_response', t('leave an answer open', '为回应留出位置'), t('A shared phrase can invite a reply, as a musical call invites a response; the reply need not be predetermined.', '共同熟悉的话语可以像音乐呼应一样邀请回答，而回答不必预先被规定。')),
  edge('welcome', 'threshold', t('enter by choice', '自主选择进入'), t('An invitation in a relationship can be staged like an entrance to a place: visible, understandable, and optional.', '关系中的邀请，可以像地点入口一样被设计：看得见、读得懂，并保留不进入的选择。')),
  edge('motif', 'inventory', t('few elements, many arrangements', '少量元素，多种安排'), t('A small set of musical material suggests exploring many arrangements of a limited set of objects.', '少量音乐材料的组织方式，可以启发我们探索有限物件的多种安排。')),
  edge('rest', 'rule', t('a rule that permits a pause', '允许停顿的规则'), t('Treat waiting or not acting as an available move rather than forcing an immediate response.', '把等待或暂不行动也设计成允许的选择，而不是要求立即回应。')),
  edge('variation', 'replay', t('compare another version', '比较另一个版本'), t('A recognizable variation and a replayed choice both invite comparison with a preserved earlier version.', '可辨认的变奏与重新尝试的选择，都邀请人将它与保留着的先前版本比较。')),
  edge('call_response', 'replay', t('same prompt, another choice', '同一提示，重新选择'), t('Call and response allows different replies to one cue. A game reload revisits a state to choose again. Borrow that comparison structure; a later visit cannot literally undo an earlier one.', '音乐呼应允许同一提示得到不同回应；游戏读档让人返回某个状态重新选择。借用这种比较结构，后一次参与并不会真的撤销前一次经历。')),
  edge('rule', 'meeting', t('coordinate a small encounter', '约定一次小小的相遇'), t('A time, capacity, or participation rule could make an encounter at a shared place easier to understand.', '一个关于时间、容量或参与方式的规则，可以让共同地点中的一次相遇更容易被理解。')),
  edge('replay', 'threshold', t('a doorway back', '返回的入口'), t('A replay point can be imagined as an entrance back into an earlier state, with the option to choose a new path.', '可以把重新开始点想象成回到先前状态的入口，并保留改走另一条路的选择。')),
  edge('sign', 'context', t('information at the point of need', '在需要的位置给出信息'), t('A wayfinding sign suggests giving the relevant context where someone must make a decision.', '路标可以启发我们：在需要作决定的位置，提供此刻相关的背景信息。')),
  edge('detour', 'variation', t('change the route, keep the destination', '改变路线，保留目的地'), t('A small detour can model a variation that preserves the larger purpose.', '小幅绕路可以成为一种变奏模型：路径改变，而更大的目的仍被保留。')),
];

const SPECS = [
  {
    id: 'writing',
    title: t('One bottle. Two memories.', '一瓶柠檬，两种记忆'),
    task: t('Find a memorable premise and scene structure for an eight-minute short film about two adult siblings saying goodbye to their old home.', '为一部八分钟短片探索有记忆点的故事命题和场景结构：两个成年手足向旧家告别。'),
    seed: t('Lemon concentrate', '柠檬浓缩液'),
    constraints: t('Two actors · one kitchen · no visual effects · the audience should see an emotional change through an ordinary action.', '两位演员 · 一间厨房 · 无特效 · 通过一个日常动作，让观众看见关系的变化。'),
    applications: {
      reduction: [t('The failed remake', '复原失败'), t('The siblings try to recreate a familiar drink. Each attempt makes their disagreement more visible; an exact recovered taste is never required.', '两人尝试复原熟悉的饮料。每次尝试都让分歧更明显；故事不需要出现一种被证明准确复原的口味。')],
      signal: [t('The smudged ratio', '模糊的比例'), t('A partly erased dilution note gives the conflict a visible object. Each sibling supplies a different missing number and a different memory.', '被擦掉一部分的配比说明，让冲突有了看得见的载体。两人为同一个缺口补上不同数字，也补上不同记忆。')],
      ritual: [t('Keep both glasses', '两杯都留下'), t('The ending changes the ritual: instead of correcting one another, the siblings label and keep two versions of the family drink.', '结尾改变原有仪式：两人不再纠正对方，而是给两种家庭饮料各写一张标签，都留下。')],
      sound: [t('Ratio: three matched shots', '《比例》：三次匹配构图'), t('Ask “How much water?” in three matched shots. Change who holds the jug; finally place it at the center so each sibling mixes a glass. Labels read 1:2 and 1:5, concentrate to water.', '三次匹配构图，都问“加多少水？”。改变谁掌水壶，最后把水壶放到桌中央，由两人各自调配。两杯分别贴上浓缩液与水的比例：1∶2、1∶5。')],
      play: [t('The last-spoon rule', '最后一勺规则'), t('With one spoon of concentrate left, they agree that each may add water once. A tiny invented rule makes control and compromise visible.', '只剩一勺浓缩液时，两人约定每人只能加一次水。一个临时发明的小规则，让控制与妥协变得可见。')],
      city: [t('A glass at the threshold', '门槛上的杯子'), t('Use the kitchen doorway as the final choice: one sibling is ready to leave; the other places a second glass within reach without asking them to stay.', '把厨房门口作为最后一个选择：一个人准备离开，另一个把第二杯放到对方够得到的位置，却没有开口挽留。')],
    },
    extraEdges: [
      edge('recipe', 'app_ritual', t('allow two recipes to coexist', '允许两种配方并存'), t('For this short film, conflicting recipes could resolve in coexistence rather than a correct answer.', '在这部短片里，配方分歧可以通过并存得到回应，而不是通过找出唯一正确答案。'), 'hypothesis'),
      edge('rest', 'call_response', t('pause before taking control', '接管之前，停顿一下'), t('In this scene, a pause after “How much water?” leaves the next action open: give an order, take the jug, or let the other person choose.', '在这个场景里，“加多少水？”之后的停顿，为下一步动作留出选择：给出指令、拿过水壶，或让对方自己决定。'), 'hypothesis'),
      edge('replay', 'app_sound', t('match the setup, change the decision', '匹配起点，改变决定'), t('Borrow a game reload as a match-cut structure: revisit the same kitchen framing, then change who controls the jug. The third version leaves room for two different ratios.', '把游戏读档借成匹配剪辑的结构：回到同一个厨房构图，再改变谁掌水壶。第三个版本为两种不同比例都留下位置。'), 'hypothesis'),
    ],
    curatedRoutes: [
      {
        id: 'writing-three-answers',
        title: t('Ratio: one question, three choices', '《比例》：同一个问题，三次选择'),
        nodeIds: ['seed', 'motif', 'rest', 'call_response', 'replay', 'app_sound'],
        output: t('Ratio — a curated short-film concept. Two adult siblings pack their old kitchen. Each passage opens with the same framing: concentrate, glasses, jug, hands. “How much water?”\n\n1. One sibling holds the jug, says “One to two,” and blocks the other hand.\n2. Match the framing. The other sibling takes the jug; grabbing and correcting turn the question into “Who decides?”\n3. Ask again. A pause. The jug moves to the table center; each sibling mixes a glass. Final labels read concentrate:water — 1:2 and 1:5.\n\nBorrow repetition and variation from a musical motif, and different choices from a game reload.', '两个成年手足清空旧厨房。三幕都从同一瓶浓缩液、杯子、水壶和手的匹配构图开始，每次都问：“加多少水？”\n\n① 一人握着水壶说“一比二”，挡住对方想改变配比的手。\n② 同一构图再次出现，另一人接管水壶。争抢与纠正，让问题变成“谁说了算”。\n③ 再问一次。停顿后，水壶被放到桌中央，两人各自调配。最后，两杯并排，分别贴着“浓缩液∶水——1∶2”和“1∶5”。\n\n借音乐动机组织重复与变奏，借游戏读档比较同一起点的不同选择。'),
        assumptions: t('A curated creative example using analogies with music and games. Two actors, one kitchen, no visual effects. Test-shoot the scene to see whether the changing relationship is clear.', '精选创作示例，音乐与游戏之间为创意类比。两位演员、一间厨房、无特效；可试拍检查关系转变是否可读。'),
      },
      {
        id: 'writing-two-recipes',
        title: t('An imperfect recipe becomes two valid memories', '不完整的配方，走向两份不同的记忆'),
        nodeIds: ['seed', 'water', 'compression', 'omission', 'recipe', 'app_ritual'],
        output: t('Short-film premise: while packing their old kitchen, two adult siblings find a bottle of lemon concentrate and a smudged dilution note. Each insists their version tastes like home. Three attempts gradually reveal that they remember different roles within the same family. In the final minute, they stop trying to correct the drink: they label two glasses differently and sit down with both. The bottle, handwritten note, pouring, and pauses carry the scene.', '短片命题：清空旧厨房时，两个成年手足找到一瓶柠檬浓缩液和一张模糊的配比说明。两人都坚持自己调出的味道才像家。三次尝试逐渐显露：他们记得的，是同一家庭里不同的位置。最后一分钟，两人停止纠正味道，给两杯饮料写上不同标签，端着各自的一杯坐下。整场戏由瓶子、手写纸条、倒水和停顿推进。'),
        assumptions: t('A proposed fictional structure. Test whether the siblings’ different memories become clear through action; neither memory needs to be declared the objective truth. The recipe is a dramatic device, not evidence about memory science.', '这是待发展的虚构结构。需要验证：两份记忆的差异能否通过动作被看懂；不必判定哪份记忆才是客观真相。配方是戏剧装置，不构成关于记忆科学的论断。'),
      },
    ],
  },
  {
    id: 'product',
    title: t('A doorway back into your work', '回到工作里的那一道门'),
    task: t('Explore a lightweight product that helps an interrupted creator return to a project and recover the intention behind their last decision.', '探索一个轻量产品，帮助经常被打断的创作者返回项目，重新找回上次决定背后的意图。'),
    seed: t('Lemon concentrate', '柠檬浓缩液'),
    constraints: t('A small web prototype · manual input first · no background tracking · preserve the creator’s choice of what matters.', '小型网页原型 · 首先支持手动输入 · 不做后台追踪 · 由创作者决定哪些信息值得保留。'),
    applications: {
      reduction: [t('Three lines before leaving', '离开前的三行'), t('A save point asks for current intention, the last chosen direction, and one next action. The creator can omit or change any field.', '在离开前保存当前意图、上次选定的方向和一个下一步动作。创作者可以留空或修改任何一项。')],
      signal: [t('A context capsule', '上下文胶囊'), t('Keep the creator’s selected intention beside a source excerpt and an unresolved question. Compactness should not erase the reason for a decision.', '把创作者选定的意图、原文片段和一个未解决问题一起保存。紧凑不应以丢掉决策理由为代价。')],
      ritual: [t('A return ritual', '一次返回仪式'), t('On return, show the last selected capsule and let the creator continue, edit the intention, or choose a different saved branch.', '返回时展示上次选定的胶囊，让创作者选择继续、修改意图或转到另一条已存路线。')],
      sound: [t('Variants of one intent', '同一意图的不同版本'), t('Pin the project intention while comparing a few saved approaches. A new version is an alternative, not an automatic replacement.', '比较几个已保存的做法时，把项目意图固定在旁边。新版本只是候选，不自动覆盖原来的版本。')],
      play: [t('A reversible next move', '可撤回的下一步'), t('Trying a next step creates a named branch with a return point. The product records the choice without treating it as permanent.', '尝试下一步时，建立一个带返回点、可以命名的分支。产品记录选择，而不把它视为不可撤回的承诺。')],
      city: [t('A doorway back', '返回入口'), t('A return card connects a saved intention to the relevant pasted text and chosen next action. A first prototype can use manual snapshots.', '返回卡把保存的意图、相关粘贴文本与选定的下一步连在一起。第一个原型可以完全使用手动快照。')],
    },
    extraEdges: [
      edge('context', 'app_signal', t('save the reason, not just the result', '保存理由，也保存结果'), t('A creator-selected capsule could retain the decision context that a short outcome-only summary omits.', '由创作者选择的胶囊，可能保留单纯总结结果时会略去的决策背景。'), 'hypothesis'),
      edge('motif', 'variation', t('retain a recognizable starting idea', '保留可辨认的起始材料'), t('A musical motif can be varied while remaining recognizable; this suggests a stable intention beside alternate approaches.', '音乐动机可以在发生变化后仍被辨认；这启发我们把稳定的意图放在不同做法旁边。'), 'analogy'),
      edge('threshold', 'app_city', t('make re-entry an explicit moment', '把重新进入做成明确时刻'), t('A dedicated return card could help someone choose how to resume instead of opening an undifferentiated archive.', '一个专门的返回卡，可能帮助人决定如何继续，而不是直接面对没有区分的资料堆。'), 'hypothesis'),
    ],
    curatedRoutes: [
      {
        id: 'product-context-capsule',
        title: t('Concentrate the work; keep the reason', '把工作浓缩，把理由留下'),
        nodeIds: ['seed', 'water', 'compression', 'omission', 'context', 'app_signal'],
        output: t('Product concept: a Context Capsule for interrupted creative work. Before leaving, the person saves three editable items: what I am trying to achieve, why I chose this direction, and what I would try next. One source excerpt stays attached so the capsule can be checked. On return, the capsule opens beside that excerpt; the person continues, changes it, or branches. Prototype with pasted text and local snapshots. Test whether people recover their own intention more accurately than from their existing notes.', '产品概念：面向被打断创作的“上下文胶囊”。离开前保存三个可编辑条目：我正在实现什么、为什么选择这个方向、回来后准备试什么。同时保留一个原文片段，便于核对。返回时，胶囊与原文一起打开，由人决定继续、修改或分叉。原型只需粘贴文本和本地快照。验证它是否比用户原有笔记更能帮助人准确找回自己的意图。'),
        assumptions: t('The value depends on people finding the brief save step worthwhile. Do not assume faster resumption or better work without testing. Let participants decide what is saved; avoid collecting unrelated activity.', '价值取决于用户是否觉得离开前的简短保存值得做。未经验证，不宣称恢复更快或作品更好。由参与者决定保存什么，不收集无关活动。'),
      },
      {
        id: 'product-return-branches',
        title: t('Return to an intention, then choose a path', '回到同一个意图，选择另一条路'),
        nodeIds: ['seed', 'motif', 'variation', 'replay', 'threshold', 'app_city'],
        output: t('Product concept: a Return Board with one pinned intention and several manually saved paths. Each path has a short excerpt, its last human decision, and an open question. Returning means entering a specific path or duplicating it to try another version; earlier work stays inspectable. The first useful flow is save → leave → return → choose → continue. Test it on one interrupted writing or design session, observing whether the creator can explain their choice without rereading the entire archive.', '产品概念：“返回面板”固定展示一个意图和几条手动保存的路线。每条路线包含短片段、上次由人作出的选择，以及一个未解决问题。返回时，可以进入某条路线，也可以复制它尝试另一个版本；旧内容仍然可回看。第一条完整流程是保存→离开→返回→选择→继续。用一次被打断的写作或设计任务，观察创作者能否不重读全部资料就解释自己的选择。'),
        assumptions: t('Multiple paths may create clutter. Test whether users understand the difference between a saved decision and a new suggestion. Keep branch naming and deletion under the user’s control.', '多条路线也可能制造混乱。需要验证用户能否分辨已保存的决定与新建议，并由用户控制分支命名和删除。'),
      },
    ],
  },
  {
    id: 'business',
    title: t('Make a small stop worth taking', '让人愿意多停留二十分钟'),
    task: t('Explore a low-cost service experiment for a neighborhood café that wants to give people a reason to visit during a quiet afternoon.', '为社区咖啡店探索一个低成本服务实验，让人有理由在客流较少的下午专门来一次。'),
    seed: t('Lemon concentrate', '柠檬浓缩液'),
    constraints: t('Use the existing café · two trial dates · no new equipment · clear pay-per-visit offer · validate demand before expanding.', '使用现有门店 · 先试两场 · 不添置新设备 · 明确按次付费 · 先验证需求再扩展。'),
    applications: {
      reduction: [t('A compact tasting kit', '一份小型尝味套组'), t('Package the offer around a small set of existing drink ingredients and a short guided activity. Avoid assuming that a smaller serving automatically costs less to run.', '围绕少量现有饮品原料和一个短时引导活动组织服务。不假定份量更小就必然意味着经营成本更低。')],
      signal: [t('One clear offer card', '一张说清楚的服务卡'), t('State the time, included drinks, participation format, capacity, and price on one card. Let a passerby judge whether the visit is for them.', '在一张卡上写清时间、包含饮品、参与方式、容量和价格，让路过的人自己判断是否适合。')],
      ritual: [t('A Wednesday mixing table', '周三调味桌'), t('Run the same short afternoon format twice: guests choose a proportion, name their version, and may exchange tasting notes.', '把同一个短时下午活动先办两次：来客选择比例、为自己的版本命名，并可自愿交换感受。')],
      sound: [t('One weekly variation', '每周一个变奏'), t('Keep the format recognizable while changing one ingredient or prompt using existing stock. Test whether the change gives people a reason to return.', '保持形式可辨认，每次用现有库存改变一个原料或问题。验证这种变化是否真的让人愿意再次到访。')],
      play: [t('A three-taste passport', '三次尝味护照'), t('An optional card records three separately purchased visits and the guest’s chosen version each time. It is a souvenir and invitation, not a required prepaid membership.', '可选卡片记录三次独立付费的到访，以及客人每次选出的版本。它是纪念和邀请，不是必须预付的会员门槛。')],
      city: [t('A walking-route stop', '散步中转站'), t('Offer a bookable twenty-minute tasting table at the café: a clearly timed, optional stop for people already nearby, with capacity set from actual staffing.', '在店内提供可预约的二十分钟尝味桌：给附近的人一个时长明确、可以选择加入的停靠点；人数上限按真实人手确定。')],
    },
    extraEdges: [
      edge('meeting', 'app_city', t('give the meeting a small format', '给碰面一个小形式'), t('A short, clearly described tasting activity could provide a concrete reason to choose this café as a stop.', '短小而说得清的尝味活动，可能给人一个把这家店选作停靠点的具体理由。'), 'hypothesis'),
      edge('recipe', 'private_code', t('name a personal version', '给自己的版本起名'), t('A guest-created recipe name could become a recognizable reference on a later visit.', '来客自己起的配方名字，可能成为下次到访时可以认出的共同参照。'), 'hypothesis'),
    ],
    curatedRoutes: [
      {
        id: 'business-small-stop',
        title: t('A small kit becomes a timed destination', '小套组，变成有时长的目的地'),
        nodeIds: ['seed', 'bottle', 'inventory', 'rule', 'meeting', 'app_city'],
        output: t('Service experiment: a twenty-minute Lemon Mixing Stop on two quiet afternoons. Use existing ingredients and equipment; show a small menu of choices and let each guest name their own mix. Sell a clearly described per-visit experience, with the price calculated from actual ingredients, staff time, and capacity. Invite reservations without expanding the setup first. Record inquiries, paid attendance, service time, and direct costs to decide whether another trial is justified.', '服务实验：在两个客流较少的下午，试办“二十分钟柠檬调味站”。使用现有原料和设备，展示一小组可选材料，让每位来客为自己的调配命名。明确按次售卖，依据实际原料、人力时间和接待能力确定价格。先接受预约，不先扩大配置。记录询问、实际付费到场、服务耗时和直接成本，再决定是否值得试下一场。'),
        assumptions: t('Demand, willingness to pay, staffing capacity, and direct costs are unknown. These are hypotheses to measure in the café’s actual operating context, not revenue forecasts. Use ingredients and service procedures the café already supports.', '需求、付费意愿、人手容量和直接成本都还未知，需要放在门店实际经营中测量。这不是收入预测；使用门店已有能力支持的原料和服务流程。'),
      },
      {
        id: 'business-taste-passport',
        title: t('A personal recipe becomes a reason to return', '自己的配方，能否成为再来一次的理由'),
        nodeIds: ['seed', 'recipe', 'private_code', 'call_response', 'replay', 'app_play'],
        output: t('Service concept: a Three-Taste Passport. On each separately paid visit, a guest records their mix, gives it a name, and answers one optional prompt, such as “What would you change next time?” The next visit offers a variation on that saved starting point. Trial the card with a small group across the two planned dates; observe voluntary returns and ask what prompted them. Keep the normal café offer available so participation remains optional.', '服务概念：“三次尝味护照”。每次独立付费到访后，客人记录配比、给版本起名，并可回答一个小问题，例如“下次你想改哪里？”。下次到访可以从自己保存的起点做一次变奏。先在已安排的两场活动中邀请少量客人试用，观察自愿回访，并询问实际回访原因。日常菜单照常提供，是否参与始终可选。'),
        assumptions: t('A personal card may be enjoyable without increasing repeat visits. Separate measured returns from the hoped-for explanation, and ask guests rather than assuming the passport caused the return. Do not infer long-term retention from two events.', '个人卡片可能有趣，却不一定增加回访。把实际回访与期待中的原因分开，询问客人，不直接认定回访由护照造成。两场活动也不足以证明长期留存。'),
      },
    ],
  },
];

const APP_PREDECESSORS = {
  reduction: 'water_back', signal: 'reconstruction', ritual: 'welcome',
  sound: 'call_response', play: 'replay', city: 'detour',
};

export const EXAMPLES = SPECS.map(({ applications, extraEdges, ...spec }) => {
  const applicationNodes = CLUSTERS.map(({ id }) => {
    const [label, description] = applications[id];
    return node(`app_${id}`, id, label, description, 'application');
  });
  const applicationEdges = CLUSTERS.map(({ id }) => edge(
    APP_PREDECESSORS[id], `app_${id}`,
    t('try it in this task', '带回这个任务试试'),
    t(`A proposed application for this task: ${applications[id][1].en}`, `这个任务中的一种候选应用：${applications[id][1].zh}`),
    'hypothesis',
  ));
  return {
    ...spec,
    graph: {
      seedId: 'seed',
      clusters: CLUSTERS.map(({ id, label }) => ({ id, label: { ...label } })),
      nodes: [
        node('seed', 'reduction', { ...spec.seed }, t(
          'A familiar object with several ways in: concentration, a recipe, a repeated gesture, and a container of possibilities. Every route is an authored creative example, not live model output.',
          '一个熟悉的物件，有浓缩、配方、重复动作和容器等多种入口。这里的每条路线都是人工编排的精选创意示例，并非实时模型输出。'), 'seed'),
        ...CONCEPTS.map((n) => ({ ...n, label: { ...n.label }, description: { ...n.description } })),
        ...applicationNodes,
      ],
      edges: [...COMMON_EDGES, ...applicationEdges, ...extraEdges].map((e) => ({
        ...e, label: { ...e.label }, reason: { ...e.reason },
      })),
    },
  };
});
