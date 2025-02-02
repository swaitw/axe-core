var fixture = document.getElementById('fixture');
var shadowSupport = axe.testUtils.shadowSupport;

describe('axe.utils.getFlattenedTree', function() {
  'use strict';
  function createStyle(box) {
    var style = document.createElement('style');
    style.textContent =
      'div.breaking { color: Red;font-size: 20px; border: 1px dashed Purple; }' +
      (box ? 'slot { display: block; }' : '') +
      'div.other { padding: 2px 0 0 0; border: 1px solid Cyan; }';
    return style;
  }

  function flattenedTreeAssertions() {
    var virtualDOM = axe.utils.getFlattenedTree(fixture.firstChild);
    assert.equal(virtualDOM.length, 1); // host
    assert.equal(virtualDOM[0].actualNode.nodeName, 'DIV');

    var parentDOM = virtualDOM[0];
    virtualDOM = virtualDOM[0].children;
    assert.equal(virtualDOM.length, 3);
    assert.equal(virtualDOM[0].actualNode.nodeName, 'STYLE');
    assert.equal(virtualDOM[0].parent, parentDOM);

    // breaking news stories
    assert.equal(virtualDOM[1].actualNode.nodeName, 'DIV');
    assert.equal(virtualDOM[1].actualNode.className, 'breaking');
    assert.equal(virtualDOM[1].parent, parentDOM);

    // other news stories
    assert.equal(virtualDOM[2].actualNode.nodeName, 'DIV');
    assert.equal(virtualDOM[2].actualNode.className, 'other');
    assert.equal(virtualDOM[2].parent, parentDOM);

    // breaking
    assert.equal(virtualDOM[1].children.length, 1);
    assert.equal(virtualDOM[1].children[0].actualNode.nodeName, 'UL');
    assert.equal(virtualDOM[1].children[0].parent, virtualDOM[1]);
    virtualDOM[1].children[0].children.forEach(function(child, index) {
      assert.equal(child.actualNode.nodeName, 'LI');
      assert.isTrue(child.actualNode.textContent === 3 * (index + 1) + '');
    });
    assert.equal(virtualDOM[1].children[0].children.length, 2);

    // other
    assert.equal(virtualDOM[2].children.length, 1);
    assert.equal(virtualDOM[2].children[0].actualNode.nodeName, 'UL');
    assert.equal(virtualDOM[2].children[0].parent, virtualDOM[2]);
    assert.equal(virtualDOM[2].children[0].children.length, 4);
  }

  function shadowIdAssertions() {
    var virtualDOM = axe.utils.getFlattenedTree(fixture);
    assert.isUndefined(virtualDOM[0].shadowId); //fixture
    assert.isUndefined(virtualDOM[0].children[0].shadowId); //host
    assert.isDefined(virtualDOM[0].children[0].children[0].shadowId);
    assert.isDefined(virtualDOM[0].children[0].children[1].shadowId);
    assert.isDefined(virtualDOM[0].children[1].children[0].shadowId);
    // shadow IDs in the same shadowRoot must be the same
    assert.equal(
      virtualDOM[0].children[0].children[0].shadowId,
      virtualDOM[0].children[0].children[1].shadowId
    );
    // should cascade
    assert.equal(
      virtualDOM[0].children[0].children[1].shadowId,
      virtualDOM[0].children[0].children[1].children[0].shadowId
    );
    // shadow IDs in different shadowRoots must be different
    assert.notEqual(
      virtualDOM[0].children[0].children[0].shadowId,
      virtualDOM[0].children[1].children[0].shadowId
    );
  }

  afterEach(function() {
    fixture.innerHTML = '';
  });

  it('should default to document', function() {
    fixture.innerHTML = '';
    var tree = axe.utils.getFlattenedTree();
    assert(tree[0].actualNode === document.documentElement);
  });

  it('should set `null` on the parent for the root node', function() {
    var tree = axe.utils.getFlattenedTree();
    assert(tree[0].parent === null);
  });

  it('creates virtual nodes in the correct order', function() {
    fixture.innerHTML = '<p><b><i></i></b></p><u><s></s></u>';

    var vNode = axe.utils.getFlattenedTree(fixture)[0];
    assert.equal(vNode.nodeIndex, 0);
    assert.equal(vNode.props.nodeName, 'div');
    assert.equal(vNode.children[0].nodeIndex, 1);
    assert.equal(vNode.children[0].props.nodeName, 'p');
    assert.equal(vNode.children[0].children[0].nodeIndex, 2);
    assert.equal(vNode.children[0].children[0].props.nodeName, 'b');
    assert.equal(vNode.children[0].children[0].children[0].nodeIndex, 3);
    assert.equal(vNode.children[0].children[0].children[0].props.nodeName, 'i');
    assert.equal(vNode.children[1].nodeIndex, 4);
    assert.equal(vNode.children[1].props.nodeName, 'u');
    assert.equal(vNode.children[1].children[0].nodeIndex, 5);
    assert.equal(vNode.children[1].children[0].props.nodeName, 's');
  });

  it('should add selectorMap to root element', function() {
    var tree = axe.utils.getFlattenedTree();
    assert.exists(tree[0]._selectorMap);
  });

  if (shadowSupport.v0) {
    describe('shadow DOM v0', function() {
      beforeEach(function() {
        function createStoryGroup(className, contentSelector) {
          var group = document.createElement('div');
          group.className = className;
          group.innerHTML =
            '<ul><content select="' + contentSelector + '"></content></ul>';
          return group;
        }

        function makeShadowTree(storyList) {
          var root = storyList.createShadowRoot();
          root.appendChild(createStyle());
          root.appendChild(createStoryGroup('breaking', '.breaking'));
          root.appendChild(createStoryGroup('other', ''));
        }
        var str =
          '<div class="stories"><li>1</li>' +
          '<li>2</li><li class="breaking" slot="breaking">3</li>' +
          '<li>4</li><li>5</li><li class="breaking">6</li></div>';
        str +=
          '<div class="stories"><li>1</li>' +
          '<li>2</li><li class="breaking" slot="breaking">3</li>' +
          '<li>4</li><li>5</li><li class="breaking">6</li></div>';
        fixture.innerHTML = str;

        fixture.querySelectorAll('.stories').forEach(makeShadowTree);
      });
      it('it should support shadow DOM v0', function() {
        assert.isDefined(fixture.firstChild.shadowRoot);
      });
      it('getFlattenedTree should return an array of stuff', function() {
        assert.isTrue(
          Array.isArray(axe.utils.getFlattenedTree(fixture.firstChild))
        );
      });
      it(
        "getFlattenedTree's virtual DOM should represent the flattened tree",
        flattenedTreeAssertions
      );
      it(
        "getFlattenedTree's virtual DOM should give an ID to the shadow DOM",
        shadowIdAssertions
      );
    });
  }

  if (shadowSupport.v1) {
    describe('shadow DOM v1', function() {
      beforeEach(function() {
        function createStoryGroup(className, slotName) {
          var group = document.createElement('div');
          group.className = className;
          // Empty string in slot name attribute or absence thereof work the same, so no need for special handling.
          group.innerHTML =
            '<ul><slot name="' +
            slotName +
            '">fallback content<li>one</li></slot></ul>';
          return group;
        }

        function makeShadowTree(storyList) {
          var root = storyList.attachShadow({ mode: 'open' });
          root.appendChild(createStyle());
          root.appendChild(createStoryGroup('breaking', 'breaking'));
          root.appendChild(createStoryGroup('other', ''));
        }
        var str =
          '<div class="stories"><li>1</li>' +
          '<li>2</li><li class="breaking" slot="breaking">3</li>' +
          '<li>4</li><li>5</li><li class="breaking" slot="breaking">6</li></div>';
        str +=
          '<div class="stories"><li>1</li>' +
          '<li>2</li><li class="breaking" slot="breaking">3</li>' +
          '<li>4</li><li>5</li><li class="breaking" slot="breaking">6</li></div>';
        str += '<div class="stories"></div>';
        fixture.innerHTML = str;

        fixture.querySelectorAll('.stories').forEach(makeShadowTree);
      });
      it('should support shadow DOM v1', function() {
        assert.isDefined(fixture.firstChild.shadowRoot);
      });
      it('getFlattenedTree should return an array of stuff', function() {
        assert.isTrue(
          Array.isArray(axe.utils.getFlattenedTree(fixture.firstChild))
        );
      });
      it(
        "getFlattenedTree's virtual DOM should represent the flattened tree",
        flattenedTreeAssertions
      );
      it(
        "getFlattenedTree's virtual DOM should give an ID to the shadow DOM",
        shadowIdAssertions
      );
      it("getFlattenedTree's virtual DOM should have the fallback content", function() {
        var virtualDOM = axe.utils.getFlattenedTree(fixture);
        assert.isTrue(
          virtualDOM[0].children[2].children[1].children[0].children.length ===
            2
        );
        assert.isTrue(
          virtualDOM[0].children[2].children[1].children[0].children[0]
            .actualNode.nodeType === 3
        );
        assert.isTrue(
          virtualDOM[0].children[2].children[1].children[0].children[0]
            .actualNode.textContent === 'fallback content'
        );
        assert.isTrue(
          virtualDOM[0].children[2].children[1].children[0].children[1]
            .actualNode.nodeName === 'LI'
        );
      });
    });
    describe('shadow DOM v1: boxed slots', function() {
      afterEach(function() {
        fixture.innerHTML = '';
      });
      beforeEach(function() {
        function createStoryGroup(className, slotName) {
          var group = document.createElement('div');
          group.className = className;
          // Empty string in slot name attribute or absence thereof work the same, so no need for special handling.
          group.innerHTML =
            '<ul><slot name="' +
            slotName +
            '">fallback content<li>one</li></slot></ul>';
          return group;
        }

        function makeShadowTree(storyList) {
          var root = storyList.attachShadow({ mode: 'open' });
          root.appendChild(createStyle(true));
          root.appendChild(createStoryGroup('breaking', 'breaking'));
          root.appendChild(createStoryGroup('other', ''));
        }
        var str =
          '<div class="stories"><li>1</li>' +
          '<li>2</li><li class="breaking" slot="breaking">3</li>' +
          '<li>4</li><li>5</li><li class="breaking" slot="breaking">6</li></div>';
        str +=
          '<div class="stories"><li>1</li>' +
          '<li>2</li><li class="breaking" slot="breaking">3</li>' +
          '<li>4</li><li>5</li><li class="breaking" slot="breaking">6</li></div>';
        str += '<div class="stories"></div>';
        fixture.innerHTML = str;

        fixture.querySelectorAll('.stories').forEach(makeShadowTree);
      });
      it("getFlattenedTree's virtual DOM should have the <slot> elements", function() {
        return; // Chrome's implementation of slot is broken
        // var virtualDOM = axe.utils.getFlattenedTree(fixture);
        // assert.isTrue(virtualDOM[0].children[1].children[0].children[0].actualNode.nodeName === 'SLOT');
      });
    });
    describe('getNodeFromTree', function() {
      afterEach(function() {
        fixture.innerHTML = '';
      });
      beforeEach(function() {
        function createStoryGroup(className, slotName) {
          var group = document.createElement('div');
          group.className = className;
          // Empty string in slot name attribute or absence thereof work the same, so no need for special handling.
          group.innerHTML =
            '<ul><slot name="' +
            slotName +
            '">fallback content<li>one</li></slot></ul>';
          return group;
        }

        function makeShadowTree(storyList) {
          var root = storyList.attachShadow({ mode: 'open' });
          root.appendChild(createStyle());
          root.appendChild(createStoryGroup('breaking', 'breaking'));
          root.appendChild(createStoryGroup('other', ''));
        }
        var str =
          '<div class="stories"><li>1</li>' +
          '<li>2</li><li class="breaking" slot="breaking">3</li>' +
          '<li>4</li><li>5</li><li class="breaking" slot="breaking">6</li></div>';
        str +=
          '<div class="stories"><li>1</li>' +
          '<li>2</li><li class="breaking" slot="breaking">3</li>' +
          '<li>4</li><li>5</li><li class="breaking" slot="breaking">6</li></div>';
        str += '<div class="stories"></div>';
        fixture.innerHTML = str;

        fixture.querySelectorAll('.stories').forEach(makeShadowTree);
      });
      it('should find the virtual node that matches the real node passed in', function() {
        axe.utils.getFlattenedTree(fixture);
        var node = document.querySelector('.stories li');
        var vNode = axe.utils.getNodeFromTree(node);
        assert.isDefined(vNode);
        assert.equal(node, vNode.actualNode);
        assert.equal(vNode.actualNode.textContent, '1');
      });
      it('should find the virtual node if it is the very top of the tree', function() {
        var virtualDOM = axe.utils.getFlattenedTree(fixture);
        var vNode = axe.utils.getNodeFromTree(
          virtualDOM[0],
          virtualDOM[0].actualNode
        );
        assert.isDefined(vNode);
        assert.equal(virtualDOM[0].actualNode, vNode.actualNode);
      });
      it('should not throw if getDistributedNodes is missing', function() {
        var getDistributedNodes = fixture.getDistributedNodes;
        fixture.getDistributedNodes = undefined;
        try {
          var virtualDOM = axe.utils.getFlattenedTree(fixture);
          var vNode = axe.utils.getNodeFromTree(
            virtualDOM[0],
            virtualDOM[0].actualNode
          );
          assert.isDefined(vNode);
          assert.equal(virtualDOM[0].actualNode, vNode.actualNode);
        } finally {
          fixture.getDistributedNodes = getDistributedNodes;
        }
      });
    });
  } else {
    it('does not throw when slot elements are used', function() {
      fixture.innerHTML = '<button><slot></slot></button>';
      assert.doesNotThrow(function() {
        axe.utils.getFlattenedTree(fixture);
      });
    });
  }

  if (shadowSupport.undefined) {
    describe('shadow dom undefined', function() {
      it('SHADOW DOM TESTS DEFERRED, NO SUPPORT');
    });
  }
});
