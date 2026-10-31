import mysql from "mysql2/promise";
const c = await mysql.createConnection({host:"localhost",port:3306,user:"root",password:"Ebussco5567@",database:"alphadeutsch"});
const show = (label, sql) => { console.log(`=== ${label} ===`); };
for (const t of ["courses","course_reg","results","users"]) {
  const [d] = await c.query(`DESCRIBE \`${t}\``);
  console.log(`=== DESCRIBE ${t} ===`);
  console.log(JSON.stringify(d));
}
console.log("=== reg_no samples ===");
const [r3] = await c.query("SELECT reg_no FROM stud2022 ORDER BY id LIMIT 12");
console.log(JSON.stringify(r3));
console.log("=== courses sample ===");
const [r4] = await c.query("SELECT * FROM courses LIMIT 6");
console.log(JSON.stringify(r4));
console.log("=== course_reg sample ===");
const [r5] = await c.query("SELECT * FROM course_reg LIMIT 6");
console.log(JSON.stringify(r5));
console.log("=== results sample ===");
const [r6] = await c.query("SELECT * FROM results LIMIT 3");
console.log(JSON.stringify(r6));
await c.end();
console.log("DONE");
