---
layout: page
title: Projects
permalink: /projects/
---

<div class="project-tabs">
    <button class="tab-btn active" onclick="openCategory('active')">Active Research</button>
    <button class="tab-btn" onclick="openCategory('completed')">Completed</button>
    <button class="tab-btn" onclick="openCategory('fun')">Old / Just for Fun</button>
    <button class="tab-btn" onclick="openCategory('future')">Future Ambitions</button>
</div>

<div class="slide-visual">
    {% assign project_uid = cat | append: "-" | append: forloop.index %}
    
    <div id="display-{{ project_uid }}" class="visual-stack">
        {% if project.gallery %}
            {% for item in project.gallery %}
                <div class="media-item {% if forloop.first %}active{% endif %}" data-index="{{ forloop.index0 }}">
                    {% if item.type == 'video' %}
                        <div class="video-container">
                            <iframe src="https://www.youtube.com/embed/{{ item.id }}" frameborder="0" allowfullscreen></iframe>
                        </div>
                    {% else %}
                        <img src="{{ item.url | relative_url }}" alt="Project Visual" class="slide-img">
                    {% endif %}
                </div>
            {% endfor %}
        
        {% elsif project.video_id %}
            <div class="media-item active">
                <div class="video-container">
                    <iframe src="https://www.youtube.com/embed/{{ project.video_id }}" frameborder="0" allowfullscreen></iframe>
                </div>
            </div>
        {% elsif project.image %}
            <div class="media-item active">
                <img src="{{ project.image | relative_url }}" alt="Project Visual" class="slide-img">
            </div>
        {% endif %}
    </div>

    {% if project.gallery.size > 1 %}
    <div class="media-controls">
        {% for item in project.gallery %}
            <button class="media-dot {% if forloop.first %}active{% endif %}" 
                    onclick="switchMedia('{{ project_uid }}', {{ forloop.index0 }})">
                {{ forloop.index }}
            </button>
        {% endfor %}
    </div>
    {% endif %}
</div>

<script>
    // 1. Tab Switching Logic
    function openCategory(categoryName) {
        // Hide all category containers
        var containers = document.getElementsByClassName("category-container");
        for (var i = 0; i < containers.length; i++) {
            containers[i].style.display = "none";
        }
        
        // Remove "active" class from tabs
        var tabs = document.getElementsByClassName("tab-btn");
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].className = tabs[i].className.replace(" active", "");
        }

        // Show the selected category and mark tab active
        document.getElementById(categoryName).style.display = "block";
        event.currentTarget.className += " active";
    }

    // 2. Slide Switching Logic
    // We keep track of the current index for each category independently
    var slideIndices = {
        'active': 0,
        'completed': 0,
        'fun': 0,
        'future': 0
    };

    function changeSlide(n, category) {
        var container = document.getElementById(category);
        var slides = container.getElementsByClassName("project-slide");
        
        // Hide current slide
        slides[slideIndices[category]].classList.remove("visible");

        // Calculate new index
        slideIndices[category] += n;

        // Loop Logic: If at end, go to start. If at start, go to end.
        if (slideIndices[category] >= slides.length) { slideIndices[category] = 0; }
        if (slideIndices[category] < 0) { slideIndices[category] = slides.length - 1; }

        // Show new slide
        slides[slideIndices[category]].classList.add("visible");
    }

    // 3. Media Switcher Logic (The 1-2-3 buttons)
    function switchMedia(projectUid, mediaIndex) {
        // 1. Find the specific project's display container
        var container = document.getElementById("display-" + projectUid);
        var items = container.getElementsByClassName("media-item");
        
        // 2. Hide all items in this specific project
        for (var i = 0; i < items.length; i++) {
            items[i].classList.remove("active");
        }
        
        // 3. Show the requested item
        items[mediaIndex].classList.add("active");

        // 4. Update the buttons (to make the clicked number bold)
        // We find the parent slide, then find the controls container inside it
        var controls = container.nextElementSibling; // The .media-controls div
        if (controls && controls.classList.contains("media-controls")) {
            var buttons = controls.getElementsByClassName("media-dot");
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].classList.remove("active");
            }
            buttons[mediaIndex].classList.add("active");
        }
    }
</script>
