const path = require("path");
const jwt = require(path.join(__dirname, "..", "realtime", "node_modules", "jsonwebtoken"));
const secret = "my_super_secret_key_for_eiscore_system_2025";
const token = jwt.sign({ role: "web_user", username: "admin", name: "管理员", dept_id: 1 }, secret, { expiresIn: "1h" });
console.log(token);
