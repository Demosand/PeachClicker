const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve(__dirname, '../bot_database.db'), sqlite3.OPEN_READONLY);

db.all("SELECT tg_id, username FROM users WHERE username LIKE '%itz4wx%'", (err, rows) => {
    console.log(rows);
    if (rows && rows.length > 0) {
        db.all("SELECT id, plan_name, days, status FROM orders WHERE user_id = ?", [rows[0].tg_id], (err2, orders) => {
            console.log("Orders for user " + rows[0].tg_id + ":");
            console.log(orders);
            db.close();
        });
    } else {
        db.close();
    }
});
