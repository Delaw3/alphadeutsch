import mysql from "mysql2/promise";
console.log("A connected");
const c = await mysql.createConnection({host:"localhost",port:3306,user:"root",password:"Ebussco5567@",database:"alphadeutsch"});
console.log("B connected");
const [d] = await c.query("DESCRIBE `stud2022`");
console.log("C queried", d.length);
console.log(JSON.stringify(d));
await c.end();
console.log("DONE");
