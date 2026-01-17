---
layout: page
title: Projects
permalink: /projects/
---

<div class="project-tabs">
    <button class="tab-btn active" onclick="openCategory('active')">Active Research</button>
    <button class="tab-btn" onclick="openCategory('completed')">Completed</button>
    <button class="tab-btn" onclick="openCategory('fun')">Old / Just for Fun</button>
    <button class="tab-btn" onclick="openCategory('future')">Future Research</button>
</div>

<div class="projects-display-area">
    {% assign categories = "active,completed,fun,future" | split: "," %}
    
    {% for cat in categories %}
    <div id="{{ cat }}" class="category-container" style="display: {% if cat == 'active' %}block{% else %}none{% endif %};">
        
        <button class="nav-arrow left" onclick="changeSlide(-1, '{{ cat }}')"><i class="fas fa-chevron-left"></i></button>
        <button class="nav-arrow right" onclick="changeSlide(1, '{{ cat }}')"><i class="fas fa-chevron-right"></i></button>

        <div class="slides-wrapper">
            {% assign cat_projects = site.data.projects | where: "category", cat %}
            
            {% if cat_projects.size > 0 %}
                {% for project in cat_projects %}
                <div class="project-slide fade {% if forloop.first %}visible{% endif %}">
                    
                    <h2 class="slide-title">{{ project.title }}</h2>
                    
                    <div class="slide-content">
                        {% if project.image or project.video_id %}
                        <div class="slide-visual">
                            {% if project.video_id %}
                            <div class="video-container">
                                <iframe src="https://www.youtube.com/embed/{{ project.video_id }}" frameborder="0" allowfullscreen></iframe>
                            </div>
                            {% elsif project.image %}
                            <img src="{{ project.image | relative_url }}" alt="{{ project.title }}" class="slide-img">
                            {% endif %}
                        </div>
                        {% endif %}

                        <div class="slide-text">
                            <p>{{ project.description }}</p>
                        </div>
                    </div>

                </div>
                {% endfor %}
            {% else %}
                <div class="project-slide visible">
                    <div class="slide-text" style="text-align:center;">
                        <h3>No projects added yet.</h3>
                        <p>Check back soon!</p>
                    </div>
                </div>
            {% endif %}
        </div>
    </div>
    {% endfor %}
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
</script>
