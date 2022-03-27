if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("./sw.js")
		.then((reg) => console.log("service worker registered", reg))
		.catch((err) => console.log("service worker not registered", err))
}

var clockInOut = document.getElementById("clock-in-out")
var id = document.getElementById("id")

clockInOut.onclick = () => {
	if (clockInOut.classList.contains("join")) {
		clockInOut.disabled = true
		;(async () => {
			var verified = await verify()
			if (verified.success) {
				var left = await join()
				if (left.success) {
					clockInOut.classList.remove("join")
					clockInOut.classList.add("leave")
					clockInOut.innerText = "Leave Queue"
					clockInOut.disabled = false
				} else {
					alert("Failed to leave queue")
				}
			} else {
				alert("Invalid Phone Number")
			}
			clockInOut.disabled = false
		})()
	} else {
		if (confirm("Are you sure you want to leave?")) {
			clockInOut.disabled = true
			;(async () => {
				var verified = await verify()
				if (verified.success) {
					var left = await leave()
					if (left.success) {
						clockInOut.classList.remove("leave")
						clockInOut.classList.add("join")
						clockInOut.innerText = "Join Queue"
						clockInOut.disabled = false
					} else {
						alert("Failed to leave queue")
					}
				} else {
					alert("Invalid Phone Number")
				}
				clockInOut.disabled = false
			})()
		}
	}
}

async function verify() {
	const response = await fetch("http://127.0.0.1:3000/verify", {
		mode: "cors",
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ id: parseInt(id.value) }),
	})
	return await response.json()
}

async function join() {
	const response = await fetch("http://127.0.0.1:3000/join", {
		mode: "cors",
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ id: parseInt(id.value) }),
	})
	return await response.json()
}

async function leave() {
	const response = await fetch("http://127.0.0.1:3000/leave", {
		mode: "cors",
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ id: parseInt(id.value) }),
	})
	return await response.json()
}
