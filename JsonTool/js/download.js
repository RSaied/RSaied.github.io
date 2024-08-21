document.getElementById('new-update').innerHTML = '<div class="col-lg-12"><h2>جديد الإصدار: 0.24</h2></div>• إضافة إمكانية استخراج ملفات Json و xml من ملف zip<br>• فتح جميع الميزات المدفوعة<br>• تعريب التطبيق بالكامل<br>• إزالة جميع الإعلانات<br>• إصلاحات وتحسينات أخرى .<br><br>';
document.getElementById('btn-download').addEventListener('click', function () {
const progressBar = document.getElementById('progress-bar2');
const progressBarInner = document.getElementById('progress-bar2-inner');
const progressText = document.getElementById('progress-text');
const speedText = document.getElementById('speed-text');
const remainingTimeText = document.getElementById('remaining-time-text');
const downloadUrl = 'https://RSaied.github.io/JsonTool/JSON Tool {V0.24} By RSaied.github.io.apk';
const downloadName = 'JSON Tool {V0.24} By RSaied.github.io.apk';

progressBar.style.display = 'block';

const xhr = new XMLHttpRequest();
xhr.open('GET', downloadUrl, true);
xhr.responseType = 'blob';

let startTime = null;
let previousLoaded = 0;
let totalBytes = 0; // Total size of the file
let remainingBytes = 0;

xhr.onprogress = function (event) {
if (event.lengthComputable) {
if (!startTime) {
startTime = new Date().getTime();
totalBytes = event.total;
}

const currentTime = new Date().getTime();
const elapsedTime = (currentTime - startTime) / 1000; // seconds
const loaded = event.loaded;
remainingBytes = totalBytes - loaded;

const percentComplete = (loaded / totalBytes) * 100;

progressBarInner.style.width = percentComplete + '%';
progressText.innerText = 'الرجاء عدم إغلاق الصفحة حتى إنتهاء التحميل\n وصل إلى : ' + Math.round(percentComplete) + '%';

const speed = (loaded - previousLoaded) / elapsedTime; // bytes per second
previousLoaded = loaded;
startTime = currentTime;

const speedKbps = (speed * 8 / 1024).toFixed(2); // kbps
speedText.innerText = 'السرعة: ' + speedKbps + ' kbps';

const remainingTime = (remainingBytes / speed).toFixed(0); // seconds
const minutes = Math.floor(remainingTime / 60);
const seconds = remainingTime % 60;
remainingTimeText.innerText = 'الوقت المتبقي: ' + minutes + ' دقيقة و ' + seconds + ' ثانية';
}
};

xhr.onload = function () {
if (xhr.status === 200) {
const url = window.URL.createObjectURL(xhr.response);
const a = document.createElement('a');
a.href = url;
a.download = downloadName;
document.body.appendChild(a);
a.click();
a.remove();

progressText.innerText = 'اكتمل تحميل التطبيق. 100%';
speedText.innerText = 'قم بفتح الملف من مجلد التنزيلات';
remainingTimeText.innerHTML = 'إذا لم تجد الملف في مجلد التنزيلات <a href="'+ downloadUrl +'" target="_blank" download>إضغط هنا للتحميل مرة أخرى</a>';
} else {
progressText.innerText = 'حدث خطأ أثناء تحميل التطبيق. الرجاء المحاولة مرة أخرى.';
}
};

xhr.onerror = function () {
progressText.innerText = 'حدث خطأ أثناء تحميل التطبيق. الرجاء المحاولة مرة أخرى.';
};

xhr.send();
});
