// Test-only OS boundary fixture. The entry has no skip flag or injected reader.
// Tests explicitly preload the generated code; the production entry never loads it.
export function loadFixture(load: number[], memory: string | { error: string }, memoryCommand = '/usr/bin/memory_pressure') {
  return `{
    const cp=require('node:child_process'),original=cp.execFile;
    require('node:os').loadavg=()=>${JSON.stringify(load)};
    cp.execFile=function(command,args,options,callback){
      if(command!==${JSON.stringify(memoryCommand)})return original.apply(this,arguments);
      const result=${JSON.stringify(memory)};
      setImmediate(()=>typeof result==='string'?callback(null,result,''):callback(new Error(result.error),'',''));
      return {pid:0};
    };
    require('node:module').syncBuiltinESMExports();
  }`;
}
