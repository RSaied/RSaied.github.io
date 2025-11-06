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
            // تعيين وقت البداية مرة واحدة فقط
            if (!startTime) {
                startTime = new Date().getTime();
                lastUpdateTime = startTime;
            }

            const currentTime = new Date().getTime();
            const timeSinceLastUpdate = (currentTime - lastUpdateTime) / 1000; // بالثواني
            
            const loaded = event.loaded;
            const total = event.total;
            const percentComplete = (loaded / total) * 100;

            // تحديث شريط التقدم
            progressBarInner.style.width = percentComplete + '%';
            progressText.innerText = 'الرجاء عدم إغلاق الصفحة حتى إنتهاء التحميل\n وصل إلى : ' + Math.round(percentComplete) + '%';

            // حساب السرعة (فقط إذا مر وقت كافي لتجنب قراءات غير دقيقة)
            if (timeSinceLastUpdate > 0.1) {
                const bytesDownloaded = loaded - previousLoaded;
                const speed = bytesDownloaded / timeSinceLastUpdate; // بايت في الثانية
                
                // تحويل إلى كيلوبت في الثانية
                const speedKbps = (speed * 8 / 1024).toFixed(2);
                speedText.innerText = 'السرعة: ' + speedKbps + ' Kbps';

                // حساب الوقت المتبقي
                const remainingBytes = total - loaded;
                if (speed > 0) {
                    const remainingSeconds = Math.floor(remainingBytes / speed);
                    const minutes = Math.floor(remainingSeconds / 60);
                    const seconds = remainingSeconds % 60;
                    remainingTimeText.innerText = 'الوقت المتبقي: ' + minutes + ' دقيقة و ' + seconds + ' ثانية';
                }

                // تحديث المتغيرات للقراءة التالية
                previousLoaded = loaded;
                lastUpdateTime = currentTime;
            }
        }
    };

    xhr.onload = function () {
        if (xhr.status === 200) {
            const blob = xhr.response;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = downloadName;
            
            // إضافة العنصر إلى الصفحة
            document.body.appendChild(a);
            
            // محاولة التحميل
            try {
                a.click();
            } catch (e) {
                // في حالة فشل click()، استخدام طريقة بديلة
                window.location.href = url;
            }
            
            // تنظيف بعد فترة قصيرة
            setTimeout(function() {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);

            progressText.innerText = 'اكتمل تحميل التطبيق. 100%';
            speedText.innerText = 'قم بفتح الملف من مجلد التنزيلات';
            remainingTimeText.innerHTML = 'إذا لم تجد الملف في مجلد التنزيلات <a href="'+ downloadUrl +'" download="' + downloadName + '">إضغط هنا للتحميل مرة أخرى</a>';
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