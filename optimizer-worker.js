function solveRoster(pool, budget, progress = () => {}) {
  const need=[4,4,2],groups=need.map((_,pos)=>pool.filter(p=>p.position===pos));
  if(groups.some((g,i)=>g.length<need[i]))return {error:'positions',counts:groups.map(g=>g.length)};
  const cheapest=groups.reduce((sum,g,i)=>sum+g.map(p=>p.cost).sort((a,b)=>a-b).slice(0,need[i]).reduce((a,b)=>a+b,0),0);
  if(cheapest>budget)return {error:'budget',minimum:cheapest/10};
  const maxCost=groups.reduce((sum,g,i)=>sum+g.map(p=>p.cost).sort((a,b)=>b-a).slice(0,need[i]).reduce((a,b)=>a+b,0),0);
  const B=Math.min(budget,maxCost),width=B+1,size=75*width;
  if(size>2000000)return {error:'size'};
  const index=(g,f,c,b)=>((g*5+f)*3+c)*width+b;
  const scores=new Float64Array(size);scores.fill(-Infinity);scores[0]=0;
  const choices=[];
  for(let i=0;i<pool.length;i++){
    const p=pool[i],bits=new Uint8Array(Math.ceil(size/8));choices.push(bits);
    const dg=p.position===0?1:0,df=p.position===1?1:0,dc=p.position===2?1:0;
    for(let g=4;g>=dg;g--)for(let f=4;f>=df;f--)for(let c=2;c>=dc;c--){
      const dest=index(g,f,c,0),src=index(g-dg,f-df,c-dc,0);
      for(let b=B;b>=p.cost;b--){const previous=scores[src+b-p.cost];if(previous===-Infinity)continue;
        const k=dest+b,score=previous+p.score;
        if(score>scores[k]+1e-9){scores[k]=score;bits[k>>3]|=1<<(k&7);}
      }
    }
    if(i%10===0)progress(Math.round((i+1)/pool.length*100));
  }
  let best=-Infinity,cost=0;
  for(let b=0;b<=B;b++){const value=scores[index(4,4,2,b)];if(value>best+1e-9){best=value;cost=b;}}
  if(best===-Infinity)return {error:'none'};
  let g=4,f=4,c=2,b=cost;const selected=[];
  for(let i=pool.length-1;i>=0;i--){const k=index(g,f,c,b);if(choices[i][k>>3]&(1<<(k&7))){
    const p=pool[i];selected.push(p.id);b-=p.cost;if(p.position===0)g--;else if(p.position===1)f--;else c--;
  }}
  if(g||f||c||b||selected.length!==10)throw Error('Invalid reconstruction');
  return {selected,cost:cost/10,score:best};
}
if(typeof self!=='undefined')self.onmessage=e=>{
  try{self.postMessage({type:'result',result:solveRoster(e.data.pool,e.data.budget,value=>self.postMessage({type:'progress',value}))});}
  catch(e){self.postMessage({type:'error',message:String(e.message)});}
};
if(typeof module!=='undefined')module.exports={solveRoster};
