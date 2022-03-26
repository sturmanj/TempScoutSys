if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("./sw.js")
		.then((reg) => console.log("service worker registered", reg))
		.catch((err) => console.log("service worker not registered", err))
}

var clockInOut = document.getElementById("clock-in-out")
var verify = document.getElementById("verify")

clockInOut.onclick = () => {
	console.log("clicked")
	if (clockInOut.classList.contains("join")) {
		clockInOut.classList.remove("join")
		clockInOut.classList.add("leave")
		clockInOut.innerText = "Leave Queue"
	} else {
		if (confirm("Are you sure you want to leave?")) {
			clockInOut.classList.remove("leave")
			clockInOut.classList.add("join")
			clockInOut.innerText = "Join Queue"
		}
	}
}
