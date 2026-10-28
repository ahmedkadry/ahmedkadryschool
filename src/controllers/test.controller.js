const testController = (req, res) => {
    // res.render('test', { title: 'Test' });
    /* res.json({
         success: true,
         message: 'test'
     })*/
    console.log('test');
    // res.status(200).json({
    //     success: true,
    //     message: 'test'
    // })
    // res.send('<h1> Allah Akber This is test page </h1>')
    res.render('test/index', { title: 'Test' });
}

module.exports = testController;