$(document).ready(function () {
    jQuery.fx.off = true;
    var viewer;

    function reinitControls() {
        $('#semantic-model').accordion('refresh');
        $('#semantic-descriptive-info').accordion('refresh');
        $('#requirements').accordion('refresh');
        $('#validation').accordion('refresh');
    }

    function initControls() {

        $('#semantic-descriptive-info').accordion({
            heightStyle: 'fill'
        });

        $('#semantic-tabs').tabs({
            activate: function (event, ui) {
                reinitControls();
            },
            create: function (event, ui) {
                $('#semantic-model').accordion({
                    heightStyle: 'fill'
                });
                $('#requirements').accordion({
                    heightStyle: 'fill'
                });
                $('#validation').accordion({
                    heightStyle: 'fill'
                });
            }
        });

        $('#btnLocate').button().click(function () {
            var id = $(this).data('id');
            if (typeof (id) != 'undefined' && viewer) {
                viewer.zoomTo(parseInt(id));
            }
        });

        $('.xbim-button').button();

        //init overlayed file input buttons
        $('#ifcButton').on('click', function () { 
            $('#ifcFileInput').click();
            return false;
        });
        $('#ifcFileInput').on('change', function () {
            $('#ifcName').html($(this).val().split(/(\\|\/)/g).pop());
        });
        $('#rqButton').on('click', function () {
            $('#rqFileInput').click();
            return false;
        });
        $('#rqFileInput').on('change', function () {
            $('#rqName').html($(this).val().split(/(\\|\/)/g).pop());
        });

    }

    var afterDialog = null;
    function showError(header, message, idAfter) {
        afterDialog = idAfter;
        $('.xbim-dialog').hide();
        $('#error-dialog-header').html(header);
        $('#error-dialog-content').html(message);
        $('#error-dialog').show();
    }
    $('#errOkButton').on('click', function () {
        $('.xbim-dialog').hide();
        $(afterDialog).show();
    });

    function whenReady(model, callback) {
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.withCredentials = true;
        xmlhttp.open('GET', configSettings.areaControllerPath + 'Services/IsModelReady?model=' + model, true);
        xmlhttp.onreadystatechange = function () {
            if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
                var data = JSON.parse(xmlhttp.responseText);
                if (data.State === 'READY') {
                    callback(model);
                } else {
                    // Wait 4 seconds before polling the server again
                    setTimeout(function () { whenReady(model, callback) }, 4000);
                }
            }
        };
        xmlhttp.send();
    }

    function checkForError(errorFileName, callback) {
        // Keep polling whilst overlay is visible
        var keepPolling = $('#overlay').is(':visible');

        var xmlhttp = new XMLHttpRequest();
        xmlhttp.withCredentials = true;
        xmlhttp.open('GET', configSettings.areaControllerPath + 'Services/IsModelReady?model=' + errorFileName, true);
        xmlhttp.onreadystatechange = function () {
            if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
                var data = JSON.parse(xmlhttp.responseText);
                if (data.State === 'READY') {
                    callback(model);
                } else if (keepPolling === true) {
                    // Wait 4 seconds before polling the server again
                    setTimeout(function () { checkForError(errorFileName, callback) }, 4000);
                }
            }
        };
        xmlhttp.send();
    }

    //load button - validate input files (extensions at least), upload files, wait for results, load browsers and the viewer
    var rBrowser;
    var browser;
    var vBrowser;
    $('#uploadButton').on('click', function () {
        $('#dialog-container').hide();
        $('#overlay-shadow').hide();

        $('#uploadMessage').text('Uploading model...');

        var ifcFile = $('#ifcFileInput')[0].files[0];
        var dpowFile = $('#rqFileInput')[0].files[0];

        var dpowLoaded = false;
        var viewerLoaded = false;

        if (ifcFile.name.indexOf('.wexbim') !== -1 || ifcFile.name.indexOf('.wexBIM') !== -1) {
            viewer.load(ifcFile);
            viewerLoaded = true;
        }

        //load requirements file straight away
        if (typeof (dpowFile) !== "undefined") {
            rBrowser.load(dpowFile);
            dpowLoaded = true;
        }

        if (typeof (dpowFile) === "undefined") {
            alert("Both files have to be defined");
            return;
        }
        

        //send both files and show results
        var filesForm = new FormData();
        filesForm.append('ifcfile', ifcFile);
        filesForm.append('dpowfile', dpowFile);
        $.ajax({
            xhrFields: {
                'withCredentials': true
            },
            url: configSettings.areaControllerPath + 'Services/UploadModelAndRequirements',  //Server script to process data
            type: 'POST',
            //xhr: function () {  // Custom XMLHttpRequest
            //    var myXhr = $.ajaxSettings.xhr();
            //    if (myXhr.upload) { // Check if upload property exists
            //        myXhr.upload.addEventListener('progress', progressHandlingFunction, false); // For handling the progress of the upload
            //    }
            //    return myXhr;
            //},
            ////Ajax events
            //beforeSend: beforeSendHandler,
            success: function (data, status, xhr) {
                var response = data;
                if (typeof (data) == 'string')
                    response = JSON.parse(data);

                //wait for wexbim and COBieLite files and load them when ready
                if (response && response.State === 'UPLOADED') {
                    var wexbim = response.WexBIMName;
                    var cobie = response.COBieName;
                    var validation = response.ValidationCOBieName;
                    var errorFile = response.ErrorName

                    // If we've loaded the viewer then we can skip these tests
                    if (!viewerLoaded) {
                        whenReady(wexbim, function () {
                            viewer.load(configSettings.areaControllerPath + 'Services/GetData?model=' + wexbim);
                            viewerLoaded = true;
                        });

                        whenReady(cobie, function () {
                            browser.load(configSettings.areaControllerPath + 'Services/GetData?model=' + cobie);
                        });
                    }

                    whenReady(validation, function () {
                        vBrowser.load(configSettings.areaControllerPath + 'Services/GetData?model=' + validation);
                        dpowLoaded = true;
                    });

                    checkForError(errorFile, function() {
                        // We have an error
                        window.location = '/Error/ServerError';
                    })

                    $('#uploadMessage').text('Processing model...');
                } else {
                    showError('Error', response.Message);
                    // Redirect to error page
                    window.location = '/Error/ServerError';
                }

            },
            error: function (xhr, status, msg) {
                showError('Error during sending IFC file', msg, '#files-upload-dialog');
                alert('Error uploading model ' + msg);

                // Redirect to error page
                window.location = '/Error/ServerError';
            },
            // Form data
            data: filesForm,
            //Options to tell jQuery not to process data or worry about content-type.
            cache: false,
            contentType: false,
            processData: false
        });
    });

    initControls();
    $(window).resize(function () {
        reinitControls();
    });

    var activeSelection = false;
    var activeIds = [];
    rBrowser = new xBrowser();
    browser = new xBrowser();
    vBrowser = new xBrowser();

    browser.on('loaded', function (args) {
        var facility = args.model.facility;
        //render parts
        browser.renderSpatialStructure('structure', true);
        browser.renderAssetTypes('assetTypes', true);
        //browser.renderSystems('systems');
        browser.renderZones('zones');
        browser.renderContacts('contacts');
        //browser.renderDocuments(facility[0], 'facility-documents');

        //open and select facility node
        $('#structure > ul > li').click();

        //hide an overlay
        //$('#overlay').hide(200);
    });

    rBrowser.on('loaded', function (args) {
        var facility = args.model.facility;
        //render parts
        rBrowser.renderSpatialStructure('r-structure', true);
        rBrowser.renderAssetTypes('r-assetTypes', true);
        //rBrowser.renderSystems('r-systems');
        rBrowser.renderZones('r-zones');
        rBrowser.renderContacts('r-contacts');
        rBrowser.renderDocuments(facility[0], 'r-facility-documents');
    });

    vBrowser.on('loaded', function (args) {
        var facility = args.model.facility;
        //render parts
        vBrowser.renderSpatialStructure('v-structure', true);
        vBrowser.renderAssetTypes('v-assetTypes', true);
        //rBrowser.renderSystems('v-systems');
        //rBrowser.renderZones('v-zones');
        //rBrowser.renderContacts('v-contacts');
        //vBrowser.renderDocuments(facility[0], 'v-facility-documents');

        //add passed mark to all objects where it's name starts with '[T]' and failed to these starting with '[F]'
        //$('#validation .xbim-tree-node').prepend('<img src='/Content/img/check16.png' style='float:left;'>');
        //$('#validation .xbim-tree-leaf').prepend('<img src='/Content/img/check16.png' style='float:left;'>');
        $('#validation .xbim-entity').each(function() {
            var span = $(this);
            var txt = span.text().trim();
            if (txt.indexOf('[T]') === 0) {
                span.prev().remove();
                span.before('<img src="' + configSettings.areaPath + 'Content/img/check16.png\" style=\"float:left;\">');
                span.text(txt.substring(3));
            } else if (txt.indexOf('[F]') === 0) {
                span.prev().remove();
                span.before('<img src="' + configSettings.areaPath + 'Content/img/err16.png\" style=\"float:left;\">');
                span.text(txt.substring(3));
            }
        });



        ////add failure mark to some documents
        //$('#validation td').prepend('<img src="' + configSettings.areaPath + 'Content/img/check16.png\" style=\"float:left;\">');
        //var ids = [0, 1, 3, 5, 8, 9, 10, 12, 16];
        //var docs = $('#validation td');
        //for (var i = 0; i < ids.length; i++) {
        //    $(docs[ids[i]]).find('img:first').remove();
        //    $(docs[ids[i]]).prepend('<img src="' + configSettings.areaPath + 'Content/img/err16.png\" style=\"float:left;\">');
        //}
    });

    //general semantic browser initialization code
    function initBrowser(browser) {
        browser.on('entityClick', function (args) {
            var span = $(args.element).children('span.xbim-entity');
            if (document._lastSelection) {
                document._lastSelection.removeClass('ui-selected');
            }
            span.addClass('ui-selected');
            document._lastSelection = span;
        });

        browser.on('entityActive', function (args) {
            var isRightPanelClick = false;
            if (args.element) {
                if ($(args.element).parents('#semantic-descriptive-info').length != 0) {
                    isRightPanelClick = true;
                }
            }

            //set ID for location button
            $('#btnLocate').data('id', args.entity.id);

            browser.renderPropertiesAttributes(args.entity, 'attrprop');
            browser.renderAssignments(args.entity, 'assignments');
            //browser.renderDocuments(args.entity, 'documents');
            //browser.renderIssues(args.entity, 'issues');

            if (isRightPanelClick) {
                $('#attrprop-header').click();
            }

            //validation
            $('#attrprop td:first-child, #assignments td:first-child, #documents td:first-child').each(function () {
                var tdName = $(this);
                var txt = tdName.text().trim();
                if (txt.indexOf('[F]') === 0) {
                    tdName.html('<img src=\"' + configSettings.areaPath + 'Content/img/err16.png\" style=\"vertical-align: middle;  margin-right: 10px;\" />' + txt.substring(3));
                } else if (txt.indexOf('[T]') === 0) {
                    tdName.html('<img src=\"' + configSettings.areaPath + 'Content/img/check16.png\" style=\"vertical-align: middle;  margin-right: 10px;\" />' + txt.substring(3));
                }
            });

            selectItemInViewer(args, false);
        });
    }

    initBrowser(browser);
    initBrowser(rBrowser);
    initBrowser(vBrowser);

    browser.on('entityDblclick', function (args) {
        selectItemInViewer(args, true, 4.0);
    });

    vBrowser.on('entityDblclick', function (args) {
        selectItemInViewer(args, true, 4.0);
    });

    function selectItemInViewer(args, zoom, distanceFactorOverride) {
        var entity = args.entity;
        var allowedTypes = ['space', 'assettype', 'asset'];
        if (allowedTypes.indexOf(entity.type) === -1) return;

        var id = parseInt(entity.id);
        if (id && viewer) {
            if (activeSelection) {
                viewer.setState(xState.UNDEFINED, activeIds);
            }

            if (viewer.renderingMode !== 'x-ray') $('#xray').click();
            if (entity.type === 'assettype') {
                var ids = [];
                for (var i = 0; i < entity.children.length; i++) {
                    id = parseInt(entity.children[i].id);
                    ids.push(id);
                }
                viewer.setState(xState.HIGHLIGHTED, ids);
                activeIds = ids;
            }
            else {
                viewer.setState(xState.HIGHLIGHTED, [id]);
                activeIds = [id];
            }

            if (zoom) {
                viewer.zoomTo(id, distanceFactorOverride);
            }

            activeSelection = true;
        }
    }

    rBrowser.on('entityDblclick', function (args) {
        var entity = args.entity;
        var allowedTypes = ['assettype'];
        if (allowedTypes.indexOf(entity.type) === -1) return;

        //find all elements of this type in the second browser and highlight them
       

    });


    //viewer set up
    var check = xViewer.check();
    var viewer = null;

    if (check.noErrors) {
        //alert('WebGL support is OK');
        viewer = new xViewer('viewer-canvas');
        viewer.background = [249, 249, 249, 255];
        //turn the main light little bit off
        viewer.lightA[3] = 0.7;
        viewer.on('mouseDown', function (args) {
            if (!activeSelection) viewer.setCameraTarget(args.id);
        });
        viewer.on('pick', function (args) {
            browser.activateEntity(args.id);
            if (activeSelection) {
                if (viewer.renderingMode === 'x-ray') $('#xray').click();
                //reset state of the selected element
                viewer.setState(xState.UNDEFINED, activeIds);
                activeSelection = false;
            }
        });
        viewer.on('dblclick', function (args) {
            var id = args.id;
            if (id == null) return;
            if (viewer.renderingMode !== 'x-ray') $('#xray').click();
            viewer.setState(xState.HIGHLIGHTED, [id]);
            activeIds = [id];
            activeSelection = true;
        });
        viewer.on('loaded', function () {
            $('#overlay').hide(200);
        });
        viewer.start();
    }
    else {
        alert('WebGL is not supported by your web browser');
        var msg = document.getElementById('msg');
        msg.innerHTML = '';
        for (var i in check.errors) {
            if (check.errors.hasOwnProperty(i)) {
                var error = check.errors[i];
                msg.innerHTML += '<div style=\"color: red;\">' + error + '</div>';
            }
        }
    }

    // ------------------------ TOOLBAR ------------------------------------------------------------//
    $('#xray').button().on('click', function () {
        if (viewer) {
            viewer.renderingMode = viewer.renderingMode === 'normal' ? viewer.renderingMode = 'x-ray' : viewer.renderingMode = 'normal';
        }
    });
    $('#hiding').buttonset();
    $('#toolbar').draggable({
        containment: '#viewer-container'
    });
    if (viewer) {
        viewer.on('pick', function (args) {
            var id = args.id;
            if (id == null) return;
            var radios = document.getElementsByName('hiding');

            for (var i = 0; i < radios.length; ++i) {
                var radio = radios[i];

                if (radio.checked) {
                    var val = radio.value;
                    if (val === 'noHiding') return;
                    if (val === 'hideOne') viewer.setState(xState.HIDDEN, [id]);
                    if (val === 'hideType') {
                        var type = viewer.getProductType(id);
                        viewer.setState(xState.HIDDEN, type);
                    }
                    break;
                }
            }
        });
    }
    $('#btnResetStates').button().on('click', function() {
        if (viewer) {
            viewer.resetStates();
            if (viewer.renderingMode === 'x-ray') $('#xray').click();
            viewer.zoomTo();
        }
    });
    $('#btnClip').button().on('click', function () {
        if (!viewer) return;
        var state = $(this).data('state');

        if (state !== 'clipping') {
            viewer.clip();
            $(this)
                .val('Unclip')
                .data('state', 'clipping');
        } else {
            viewer.unclip();
            $(this)
                .val('Clip')
                .data('state', '');
        }
    });

    // ---------------------------------- FOR DEVELOPMENT ONLY ------------------------------------ //
    if (false) { //set this to false for production
        //Hide upload overlay
        $('#overlay').hide(200);
    
        //Load default data    
        browser.load(configSettings.areaPath + 'Data/Lakeside_Restaurant_stage6_Delivered.DPoW.json');
        rBrowser.load(configSettings.areaPath + 'Data/Lakeside_Restaurant_stage6_Requirements.DPoW.json');
        vBrowser.load(configSettings.areaPath + 'Data/Lakeside_Restaurant_stage6_Validation.DPoW.json');
        viewer.load(configSettings.areaPath + 'Data/Lakeside_Restaurant.wexBIM');
    }
    //----------------------------- END OF DEVELOPMENT SECTION ----------------------------------- //

});