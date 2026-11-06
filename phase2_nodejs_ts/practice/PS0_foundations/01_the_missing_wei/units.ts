// ⚠️ This is the code that shipped. It passes a quick manual test with "1" and "0.5",
// which is exactly why nobody caught it. Rewrite both functions.

export function isValidNumber(value: string): boolean {
  const regex = /^-?(\d+\.?\d*|\d*\.?\d+)$/;
  return regex.test(value);
}

export function hasDecimal(value: string): boolean {
  const regex = /\.+/;
  return regex.test(value);
}

export function isNegative(value: string): boolean {
  return value[0] == "-"?true:false;
}

export function parseUnits(value: string, decimals: number): bigint {
  if(!isValidNumber(value)) {
    throw new Error(`Given value is not a number: ${value}`)
  }

  let resultString: string = "";
  const containsDecimal: boolean = hasDecimal(value);
  const negativeValue = isNegative(value);

  // two conditions if the value has decimal and if not 
  // for value having decimal 
  if(containsDecimal) {
    
    // for suffix if difference between digits after decimal and decimals is negative than append 0s to that part of the difference otherwise if difference is positive than remove extra digits same as difference from last

    const valueSplit = value.split(".");
    const prefix = valueSplit[0];
    // const modPrefix = BigInt(prefix) < BigInt(0)? BigInt("-"+prefix): BigInt(prefix);
    const modPrefix = prefix[0] == "-"? BigInt(prefix.slice(1)):BigInt(prefix);
    const suffix = valueSplit[1];
    resultString = suffix;

    if(suffix.length - decimals <= 0) {
       for(let i = decimals - suffix.length; i>0; i--){
        resultString += "0";
       }
    } else {
      // resultString = suffix.slice(0, decimals);
      throw new Error("more digits after decimal than the decimals.")
    }
     
    
    // for prefix we are going to slice or split the string till decimal 
    // if prefix is greater than 0 than append to suffix otherwise not 
    if(modPrefix > BigInt(0)){
      resultString = modPrefix + resultString;
    }
    if(negativeValue) resultString = "-" + resultString;
  }else {
      resultString = value;
       for(let i = decimals; i>0; i--){
        resultString += "0";
       }
    
  }



  // Now for not having decimal
  // just need to append 0s or remove extra digits from last 


  return BigInt(resultString);
}

// export function formatUnits(amount: bigint, decimals: number): string {
//   if(amount == BigInt(0)) return "0";
//   let amountStr = amount < BigInt(0) ? BigInt(-amount).toString() : amount.toString();
//   const isNegAmount = isNegative(amount.toString());
//   let result = ""
//   let ai=amountStr.length-1;
//   for( let di=decimals; di>0; di--, ai--) {
//     if(amountStr[ai] != "0" && amountStr[ai] != undefined){
//       result=amountStr[ai]+result;
//     }else if(amountStr[ai] == undefined) {
//       result= "0"+result;
//     }
//   }
//   if(amountStr.length <= decimals) {
//     result = "0."+result;

//   }else {
//     if(ai >= 0) {
//       result = amountStr.slice(0, -1 * decimals) + "." +result;
//     }else{

//       result = amountStr.slice(ai+2)[0] + "." + result;
//     }
//   }
//   if(result[result.length-1]== ".") result = result.slice(0, result.length-1) 
//     if(isNegAmount) return "-"+result;
//   return result;
// }

export function formatUnits(amount: bigint, decimals: number): string {
  const isNegative = amount.toString()[0] == "-";
  const amountString = isNegative?amount.toString().slice(1):amount.toString();
  let resultString = "";
  if(amountString.length <= decimals) {
    resultString = amountString;
    let ai = amountString.length - 1;
    let di = decimals;
    while(di > 0 && ai > 0) {
      if(amountString[ai] != "0") break;
      resultString = resultString.slice(0, ai);
      ai--;
      di--;
    }
    const zerosToAppend = decimals - amountString.length;
    for(let i = 0; i< zerosToAppend; i++) {
      resultString = "0"+resultString;
    }
    if(BigInt(resultString) == BigInt(0)) return "0";
    resultString = "0."+resultString;

  }else {
    const prefix = amountString.slice(0, amountString.length - decimals);
    let suffix = amountString.slice((amountString.length - decimals));
    resultString = prefix;
    if(BigInt(suffix) == BigInt(0)) {
      resultString = isNegative? "-" + resultString: resultString;
      return resultString;
    }
    let di = min(decimals -1 , suffix.length -1);
    while(di > 0) {
      if(suffix[di] != "0") break;
      suffix = suffix.slice(0, di);
      di--; 
    }
    resultString = resultString + "." + suffix;
  }
  isNegative?resultString = "-"+resultString: resultString;
  return resultString;
}

function min(a: number, b: number): number {
  if(a < b) return a;
  return b;
}