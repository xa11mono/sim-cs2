// Проверка единственного писателя поля Р3.2 по AST исходника.
"use strict";

const walk = require("acorn-walk");
const GS = require("./game_src");
const mutations = new Set(["push","pop","shift","unshift","splice","sort","reverse","fill","copyWithin","set","add","delete","clear"]);
const namesOfBots = new Set(["b","bot","bt","sh","shooter","target","vic","victim","att","killer","mate"]);
const writeNodes = new Set(["AssignmentExpression","UpdateExpression","UnaryExpression","ForInStatement","ForOfStatement","CallExpression"]);

function literalKey(node){
  if(node?.type === "Literal" && (typeof node.value === "string" || typeof node.value === "number")) return String(node.value);
  if(node?.type === "TemplateLiteral" && !node.expressions.length) return node.quasis[0].value.cooked;
  if(node?.type === "BinaryExpression" && node.operator === "+"){
    const a = literalKey(node.left), b = literalKey(node.right);
    if(a !== undefined && b !== undefined) return a + b;
  }
}

function memberKey(node){
  return node.computed ? literalKey(node.property) : node.property.name;
}

function looksLikeBot(node){
  return node?.type === "Identifier" && namesOfBots.has(node.name)
    || node?.type === "MemberExpression" && node.object.name === "bots" && node.computed;
}

function enclosingDeclaration(anc){
  for(let i = anc.length - 1; i >= 1; i--) if(anc[i].type === "FunctionDeclaration") return anc[i].id.name;
  return "(верх файла)";
}

function localAliases(ast){
  const aliases = new WeakMap();
  walk.ancestor(ast,{ VariableDeclaration(node, anc){
    const scope = anc.slice(0,-1).findLast(n => n.type === "Program"
      || (node.kind === "var" ? /Function/.test(n.type) : n.type === "BlockStatement" || n.type === "ForStatement"));
    if(!aliases.has(scope)) aliases.set(scope,new Map());
    const bindings = aliases.get(scope);
    for(const {id, init} of node.declarations) if(id.type === "Identifier"){
      const value = init?.type === "LogicalExpression" && init.operator === "||" ? init.left : init;
      bindings.set(id.name, !bindings.has(id.name) && value ? {value, constant:node.kind === "const"} : null);
    }
  }});
  return aliases;
}

function check({ asts, tops, owners, collisions, fileAt, lineAt }){
  const fields = Object.fromEntries(Object.entries(owners).filter(([, value]) => value.exclusive === true));
  const seen = new Map();
  const topStarts = new Set(tops.map(({ s }) => s));
  const errors = [];
  const tally = new Map(collisions.map(({file, function:fn, field, expression, count}) =>
    [JSON.stringify([file, fn, field, expression]), count]));
  for(const [field, rule] of Object.entries(fields)){
    if(!rule.enforce || !rule.ownerFile || typeof rule.writer !== "string" || rule.allow || rule.files){
      errors.push(field + ": требуется один владелец-функция, один файл и enforce");
    }
  }

  for(const {ast, off, src} of asts){
    const aliases = localAliases(ast);
    walk.fullAncestor(ast, (node, _state, anc) => {
      if(!writeNodes.has(node.type)) return;
      const source = fileAt(off + node.start)[2];
      const file = GS.fileId(source);
      const fn = enclosingDeclaration(anc);
      const expression = src.slice(node.start,node.end);
      const invalid = field => errors.push(source + ":" + lineAt(off + node.start) + " " + fn + " пишет " + field);
      function resolve(tgt, keysOnly = false){
        const visited = new Set();
        while(tgt?.type === "Identifier" && !visited.has(tgt.name)){
          visited.add(tgt.name);
          const scope = anc.findLast(a => aliases.get(a)?.has(tgt.name));
          if(!scope) break;
          const binding = aliases.get(scope).get(tgt.name);
          if(!binding || binding.value.start > node.start || keysOnly && !binding.constant) break;
          tgt = binding.value;
        }
        return tgt;
      }
      function record(field, depth, direct){
        const rule = Object.hasOwn(fields, field) && fields[field];
        if(!rule) return;
        const collision = JSON.stringify([source,fn,field,expression]);
        if(tally.get(collision) > 0){
          tally.set(collision,tally.get(collision)-1);
          return;
        }
        if(depth && file === rule.ownerFile) return;   // вложенные части состояния меняет сам канал
        const outer = anc.at(-2);
        const owner = outer?.type === "ReturnStatement" && anc.at(-3)?.type === "BlockStatement"
          && anc.at(-4)?.type === "FunctionDeclaration" && topStarts.has(off + anc.at(-4).start)
          && anc.at(-4).id.name === rule.writer;
        if(direct && !depth && file === rule.ownerFile && owner){
          seen.set(field,(seen.get(field)||0)+1);
          return;
        }
        invalid(field + " мимо " + rule.ownerFile + "." + rule.writer);
      }
      const inspected = new Set();
      function target(tgt, depth = 0, direct = false){
        if(depth) tgt = resolve(tgt);
        if(!tgt || inspected.has(tgt)) return;
        inspected.add(tgt);
        if(tgt.type === "MemberExpression"){
          const key = tgt.computed ? literalKey(resolve(tgt.property,true)) : memberKey(tgt);
          if(key !== undefined) record(key,depth,direct);
          else if(looksLikeBot(resolve(tgt.object))){
            // Старт чистого матча удаляет неприсутствующие в BOT_INIT ключи до живого тика.
            const reset = source === "round.js" && fn === "matchBegin"
              && (expression === "delete b[k]" || expression === "b[k] = I.vals[k]");
            if(!reset) invalid("поле игрока через вычисляемый ключ");
          }
          target(tgt.object,depth+1,false);
        } else if(tgt.type === "ObjectPattern"){
          tgt.properties.forEach(p => target(p.value || p.argument));
        } else if(tgt.type === "ArrayPattern"){
          tgt.elements.forEach(p => target(p));
        } else if(tgt.type === "AssignmentPattern" || tgt.type === "RestElement"){
          target(tgt.left || tgt.argument);
        }
      }

      if(node.type === "AssignmentExpression") target(node.left,0,node.operator === "=");
      if(node.type === "UpdateExpression" || node.type === "UnaryExpression" && node.operator === "delete") target(node.argument);
      if(node.type === "ForInStatement" || node.type === "ForOfStatement") target(node.left);
      if(node.type !== "CallExpression" || node.callee.type !== "MemberExpression") return;
      const method = memberKey(node.callee), api = node.callee.object.name;
      if(mutations.has(method)) target(node.callee.object,1);
      if(api === "Reflect" && ["set","deleteProperty","defineProperty"].includes(method)
        || api === "Object" && method === "defineProperty"){
        const [object, prop] = node.arguments;
        target(object,1);
        const key = literalKey(resolve(prop,true));
        if(key !== undefined) record(key,0,false);
        else if(looksLikeBot(object)) invalid("поле игрока через вычисляемый ключ");
      } else if(api === "Object" && ["assign","defineProperties"].includes(method)){
        const [object,...args] = node.arguments;
        target(object,1);
        if(object.type === "ObjectExpression") return;   // создание отдельного объекта
        if(source === "throw.js" && fn === "throwNadeTry" && object.type === "CallExpression" && object.callee.name === "nadeState") return;
        for(const arg of args){
          if(arg.type !== "ObjectExpression" && looksLikeBot(object)) invalid("поля игрока из динамического объекта");
          if(arg.type !== "ObjectExpression") continue;
          for(const p of arg.properties){
            const key = !p.computed && p.key?.type === "Identifier" ? p.key.name : literalKey(p.key);
            if(key !== undefined) record(key,0,false);
            else if(looksLikeBot(object)) invalid("поле игрока через вычисляемый ключ");
          }
        }
      }
    });
  }
  for(const field of Object.keys(fields)) if(seen.get(field) !== 1){
    errors.push(field + ": физический писатель должен быть один, найдено " + (seen.get(field)||0));
  }
  for(const [site, remaining] of tally) if(remaining) errors.push("устарело различение одноимённой записи: " + site);
  return {count:seen.size, errors};
}

module.exports = {check};
