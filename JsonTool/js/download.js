document.getElementById('new-update').innerHTML = '<div class="col-lg-12"><h2>جديد الإصدار: 0.24</h2></div>• إضافة إمكانية استخراج ملفات Json و xml من ملف zip<br>• فتح جميع الميزات المدفوعة<br>• تعريب التطبيق بالكامل<br>• إزالة جميع الإعلانات<br>• إصلاحات وتحسينات أخرى .<br><br>';

document.getElementById('btn-download').addEventListener('click', function () {
    const progressBar = document.getElementById('progress-bar2');
    const progressBarInner = document.getElementById('progress-bar2-inner');
    const progressText = document.getElementById('progress-text');
    const speedText = document.getElementById('speed-text');
    const remainingTimeText = document.getElementById('remaining-time-text');
    const downloadUrl = './JSON Tool {V0.24} By RSaied.github.io.apk';
    const downloadName = 'JSON Tool {V0.24} By RSaied.github.io.apk';

    progressBar.style.display = 'block';

    const xhr = new XMLHttpRequest();
    xhr.open('GET', downloadUrl, true);
    xhr.responseType = 'blob';

    let startTime = null;
    let lastUpdateTime = null;
    let previousLoaded = 0;

    xhr.onprogress = function (event) {
        if (event.lengthComputable) {
            if (!startTime) {
                startTime = new Date().getTime();
                lastUpdateTime = startTime;
            }

            const currentTime = new Date().getTime();
            const timeSinceLastUpdate = (currentTime - lastUpdateTime) / 1000;
            
            const loaded = event.loaded;
            const total = event.total;
            const percentComplete = (loaded / total) * 100;

            progressBarInner.style.width = percentComplete + '%';
            progressText.innerText = 'الرجاء عدم إغلاق الصفحة حتى إنتهاء التحميل\n وصل إلى : ' + Math.round(percentComplete) + '%';

            if (timeSinceLastUpdate > 0.1) {
                const bytesDownloaded = loaded - previousLoaded;
                const speed = bytesDownloaded / timeSinceLastUpdate;
                
                const speedKbps = (speed * 8 / 1024).toFixed(2);
                speedText.innerText = 'السرعة: ' + speedKbps + ' Kbps';

                const remainingBytes = total - loaded;
                if (speed > 0) {
                    const remainingSeconds = Math.floor(remainingBytes / speed);
                    const minutes = Math.floor(remainingSeconds / 60);
                    const seconds = remainingSeconds % 60;
                    remainingTimeText.innerText = 'الوقت المتبقي: ' + minutes + ' دقيقة و ' + seconds + ' ثانية';
                }

                previousLoaded = loaded;
                lastUpdateTime = currentTime;
            }
        }
    };

    xhr.onload = function () {
        if (xhr.status === 200) {
            const blob = xhr.response;
            
            // إنشاء رابط مباشر للتحميل
            const url = window.URL.createObjectURL(blob);
            
            // إنشاء زر تحميل بدلاً من التحميل التلقائي
            progressText.innerHTML = '✅ اكتمل تحميل التطبيق. 100%<br><br><button id="save-file-btn" style="background: #EEA33F; color: white; padding: 15px 30px; border: none; border-radius: 8px; font-size: 18px; cursor: pointer; font-weight: bold; margin: 10px 0;">💾 اضغط هنا لحفظ الملف</button>';
            speedText.innerText = '';
            remainingTimeText.innerHTML = 'إذا لم يعمل الزر أعلاه <a href="'+ downloadUrl +'" download="' + downloadName + '" style="color: #007bff; text-decoration: underline;">إضغط هنا للتحميل المباشر</a>';
            
            // إضافة حدث للزر
            document.getElementById('save-file-btn').addEventListener('click', function() {
                // محاولة 1: استخدام download attribute
                const a = document.createElement('a');
                a.href = url;
                a.download = downloadName;
                document.body.appendChild(a);
                a.click();
                
                // محاولة 2: فتح في نافذة جديدة (backup)
                setTimeout(function() {
                    try {
                        window.open(url, '_blank');
                    } catch (e) {
                        console.log('Fallback method attempted');
                    }
                }, 100);
                
                // تنظيف
                setTimeout(function() {
                    if (document.body.contains(a)) {
                        document.body.removeChild(a);
                    }
                }, 500);
                
                // تحديث النص
                document.getElementById('save-file-btn').innerText = '✓ تم النقر - تحقق من التنزيلات';
                document.getElementById('save-file-btn').style.background = '#6c757d';
            });
            
        } else {
            progressText.innerText = 'حدث خطأ أثناء تحميل التطبيق. الرجاء المحاولة مرة أخرى.';
            speedText.innerText = '';
            remainingTimeText.innerText = '';
        }
    };

    xhr.onerror = function () {
        progressText.innerText = 'حدث خطأ أثناء تحميل التطبيق. الرجاء المحاولة مرة أخرى.';
        speedText.innerText = '';
        remainingTimeText.innerText = '';
    };

    xhr.send();
});
