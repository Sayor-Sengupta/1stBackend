const asyncHandler = (requestHandler) => {
 return (req, res, next) => {
     Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};
export { asyncHandler };

//try catch version
// const asyncHandler =(fn)=> async ()=>{
//     try {
//         await fn(req,res,next)
//     } catch (error) {
//         res.status(err.code || 500).json({
//             sucess:false,
//             message: err.message
//         })
//     }
// }
