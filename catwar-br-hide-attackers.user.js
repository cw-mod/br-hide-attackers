// ==UserScript==
// @name         CatWar: скрытие имени нападающего в логе БР
// @namespace    catwar-br-hide
// @version      1.1.0
// @description  Скрывает имя нападающего в логе боевого режима (БР). Работает вместе с юзерскриптом uwu и без него. Заменяет имя на странице лога боя.
// @author       local
// @match        https://catwar.su/cw3
// @match        https://catwar.su/cw3/
// @match        https://catwar.su/cw3?*
// @match        https://catwar.su/cw3/*
// @match        https://catwar.net/cw3
// @match        https://catwar.net/cw3/
// @match        https://catwar.net/cw3?*
// @match        https://catwar.net/cw3/*
// @updateURL    https://cw-mod.github.io/br-hide-attackers/catwar-br-hide-attackers.meta.js
// @downloadURL  https://cw-mod.github.io/br-hide-attackers/catwar-br-hide-attackers.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';


    /* =========================================================
     *  НАСТРОЙКИ
     * ========================================================= */


    // Чем заменить имя нападающего.
    // Например: '???', '***', '[скрыто]', '' (пусто — имя просто исчезнет).
    const REPLACEMENT = '???';


    /* =========================================================
     *  ВНУТРЕННЯЯ РЕАЛИЗАЦИЯ
     * ========================================================= */


    // Селекторы для обоих вариантов вёрстки: с uwu и без него.
    const CONTAINER_SELECTORS = [
        '#fightLog',                     // стандартный лог боя
        '#uwu-Compacted-Fight-Log',      // компактный лог от юзерскрипта uwu
    ];


    // Записи лога:
    //   uwu:      <div class="log_paws"><span class="text">Имя => я (хвост)</span><label class="count"> x1</label></div>
    //   стандарт: <span class="log_paws">Имя => я (хвост)</span> — текст лежит прямо в спане, без .text
    // Поэтому берём и .text (uwu), и сами спаны записей log_* (стандарт).
    const ENTRY_SELECTOR = '.text, span[class^="log_"]';


    const FLAG_ATTR = 'data-cw-hide-attacker';


    // Регулярка: берём любой текст от начала строки до " => " и заменяем его на REPLACEMENT.
    // Поддерживает как HTML-экранированную стрелку "=&gt;", так и обычную "=>".
    // В catwar имя может содержать любые символы, поэтому жадно берём всё до стрелки.
    const attackerRegex = /^[\s\S]*?(\s*=>\s*|\s*=&gt;\s*)/;


    function transformText(text) {
        if (!text) return text;
        const m = text.match(attackerRegex);
        if (!m) return text;
        // Заменяем найденный кусок (имя + стрелка) на REPLACEMENT + стрелка.
        return text.replace(attackerRegex, REPLACEMENT + '$1');
    }


    // Обрабатываем одну запись лога (.text или span.log_*).
    function processTextSpan(span) {
        if (!span || span.nodeType !== Node.ELEMENT_NODE) return;
        if (span.getAttribute(FLAG_ATTR) === '1') return;


        const original = span.textContent;
        const modified = transformText(original);
        if (modified !== original) {
            span.textContent = modified;
        }
        // Помечаем, чтобы не обрабатывать повторно (счётчик xN меняется в .count, не в .text).
        span.setAttribute(FLAG_ATTR, '1');
    }


    // Обрабатываем контейнер лога целиком.
    function processContainer(container) {
        if (!container) return;
        const spans = container.querySelectorAll(ENTRY_SELECTOR);
        spans.forEach(processTextSpan);
        if (container.matches && container.matches(ENTRY_SELECTOR)) {
            processTextSpan(container);
        }
    }


    // Сохраняем наблюдатели, чтобы не вешать их дважды на один и тот же контейнер.
    const observedContainers = new WeakSet();


    function watchContainer(container) {
        if (!container || observedContainers.has(container)) return;
        observedContainers.add(container);


        processContainer(container);


        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                // Новые узлы — обрабатываем их.
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (node.matches && node.matches(ENTRY_SELECTOR)) {
                        processTextSpan(node);
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll(ENTRY_SELECTOR).forEach(processTextSpan);
                    }
                }
                // Изменения внутри существующих записей (на всякий случай).
                if (
                    mutation.target &&
                    mutation.target.matches &&
                    mutation.target.matches(ENTRY_SELECTOR)
                ) {
                    // Снимаем флаг и обрабатываем заново — возможно, игра переписала текст.
                    mutation.target.removeAttribute(FLAG_ATTR);
                    processTextSpan(mutation.target);
                }
            }
        });


        observer.observe(container, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }


    function init() {
        // 1) Сразу обрабатываем уже существующие контейнеры.
        CONTAINER_SELECTORS.forEach(sel => {
            document.querySelectorAll(sel).forEach(watchContainer);
        });


        // 2) Следим за появлением контейнеров в DOM (могут быть созданы позже).
        const bodyObserver = new MutationObserver(() => {
            CONTAINER_SELECTORS.forEach(sel => {
                document.querySelectorAll(sel).forEach(container => {
                    if (!observedContainers.has(container)) {
                        watchContainer(container);
                    }
                });
            });
        });
        bodyObserver.observe(document.body, { childList: true, subtree: true });
    }


    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
